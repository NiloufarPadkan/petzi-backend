import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserNoteResponseDto } from './dto/user-note.dto';
import { UserNote } from './entities/user-note.entity';
import { User } from './entities/user.entity';

@Injectable()
export class AdminUserNotesService {
  constructor(
    @InjectRepository(UserNote)
    private readonly notesRepository: Repository<UserNote>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(userId: string): Promise<UserNoteResponseDto[]> {
    await this.assertUserExists(userId);
    const notes = await this.notesRepository.find({
      where: { userId },
      relations: { author: true },
      order: { createdAt: 'DESC' },
    });
    return notes.map((note) => this.toResponse(note));
  }

  async create(
    userId: string,
    authorId: string,
    content: string,
  ): Promise<UserNoteResponseDto> {
    await this.assertUserExists(userId);
    const note = await this.notesRepository.save(
      this.notesRepository.create({ userId, authorId, content }),
    );
    return this.findOne(userId, note.id);
  }

  async update(
    userId: string,
    noteId: string,
    content: string,
  ): Promise<UserNoteResponseDto> {
    await this.getNoteOrThrow(userId, noteId);
    await this.notesRepository.update({ id: noteId, userId }, { content });
    return this.findOne(userId, noteId);
  }

  async remove(userId: string, noteId: string): Promise<void> {
    const note = await this.getNoteOrThrow(userId, noteId);
    await this.notesRepository.remove(note);
  }

  private async findOne(
    userId: string,
    noteId: string,
  ): Promise<UserNoteResponseDto> {
    const note = await this.getNoteOrThrow(userId, noteId);
    return this.toResponse(note);
  }

  private async getNoteOrThrow(
    userId: string,
    noteId: string,
  ): Promise<UserNote> {
    await this.assertUserExists(userId);
    const note = await this.notesRepository.findOne({
      where: { id: noteId, userId },
      relations: { author: true },
    });
    if (!note) {
      throw new NotFoundException('یادداشت یافت نشد');
    }
    return note;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.usersRepository.exists({
      where: { id: userId, role: UserRole.USER },
    });
    if (!exists) {
      throw new NotFoundException('کاربر یافت نشد');
    }
  }

  private toResponse(note: UserNote): UserNoteResponseDto {
    return {
      id: note.id,
      content: note.content,
      author: note.author
        ? { id: note.author.id, fullName: note.author.fullName }
        : null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}

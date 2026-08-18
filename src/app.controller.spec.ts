import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the service health status', async () => {
      const result = await appController.getHealth();

      expect(result).toMatchObject({
        status: 'ok',
        service: 'petzi-backend',
        database: 'connected',
      });
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});

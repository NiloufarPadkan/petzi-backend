import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicPermission } from './clinic-panel.constants';
import {
  ClinicPanel,
  CurrentClinic,
  RequirePermission,
} from './clinic-panel.guard';
import type { ClinicContext } from './clinic-panel.guard';
import { ClinicTeamService } from './clinic-team.service';
import {
  AddExistingMemberDto,
  CreateRoleDto,
  InviteMemberDto,
  RoleMemberDto,
  UpdateMemberDto,
  UpdateRoleDto,
} from './dto/team.dto';

@ApiTags('Clinic Team')
@ClinicPanel()
@Controller('clinic/team')
export class ClinicTeamController {
  constructor(private readonly teamService: ClinicTeamService) {}

  @Get()
  @ApiOperation({ summary: 'Clinic members, manager first' })
  list(@CurrentClinic() ctx: ClinicContext) {
    return this.teamService.listMembers(ctx);
  }

  @Get(':memberId')
  @ApiOperation({
    summary: 'Member profile: contact, hours, services, rating, performance',
  })
  get(
    @CurrentClinic() ctx: ClinicContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamService.getMember(ctx, memberId);
  }

  @Post('invite')
  @RequirePermission(ClinicPermission.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Create a staff/vet account for a new member (signs in by OTP)',
  })
  invite(@CurrentClinic() ctx: ClinicContext, @Body() dto: InviteMemberDto) {
    return this.teamService.invite(ctx, dto);
  }

  @Post('add-existing')
  @RequirePermission(ClinicPermission.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'Add an already registered vet by phone number' })
  addExisting(
    @CurrentClinic() ctx: ClinicContext,
    @Body() dto: AddExistingMemberDto,
  ) {
    return this.teamService.addExisting(ctx, dto);
  }

  @Patch(':memberId')
  @RequirePermission(ClinicPermission.MEMBERS_MANAGE)
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamService.updateMember(ctx, memberId, dto);
  }

  @Delete(':memberId')
  @RequirePermission(ClinicPermission.MEMBERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentClinic() ctx: ClinicContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamService.removeMember(ctx, memberId);
  }
}

@ApiTags('Clinic Roles')
@ClinicPanel(ClinicPermission.MEMBERS_MANAGE)
@Controller('clinic/roles')
export class ClinicRolesController {
  constructor(private readonly teamService: ClinicTeamService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Permission catalog, grouped for the role editor' })
  permissions() {
    return this.teamService.permissionCatalog();
  }

  @Get()
  list(@CurrentClinic() ctx: ClinicContext) {
    return this.teamService.listRoles(ctx);
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Role with its members and addable members' })
  get(
    @CurrentClinic() ctx: ClinicContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.teamService.getRole(ctx, roleId);
  }

  @Post()
  create(@CurrentClinic() ctx: ClinicContext, @Body() dto: CreateRoleDto) {
    return this.teamService.createRole(ctx, dto);
  }

  @Patch(':roleId')
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.teamService.updateRole(ctx, roleId, dto);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role; its members lose its permissions' })
  @ApiNoContentResponse()
  remove(
    @CurrentClinic() ctx: ClinicContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.teamService.deleteRole(ctx, roleId);
  }

  @Post(':roleId/members')
  @ApiOperation({ summary: 'Give a member this role' })
  addMember(
    @CurrentClinic() ctx: ClinicContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: RoleMemberDto,
  ) {
    return this.teamService.assignRoleMember(ctx, roleId, dto.memberId);
  }

  @Delete(':roleId/members/:memberId')
  @ApiOperation({ summary: 'Take this role away from a member' })
  removeMember(
    @CurrentClinic() ctx: ClinicContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamService.unassignRoleMember(ctx, roleId, memberId);
  }
}

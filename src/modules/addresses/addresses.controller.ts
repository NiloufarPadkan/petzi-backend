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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponseDto } from './dto/address-response.dto';

@ApiTags('Addresses')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('users/me/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's addresses" })
  @ApiOkResponse({ type: [AddressResponseDto] })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.addressesService.findAllByUser(req.user.sub);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Create a new address' })
  @ApiCreatedResponse({ type: AddressResponseDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(req.user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an address (partial)' })
  @ApiParam({ name: 'id', description: 'Address UUID' })
  @ApiOkResponse({ type: AddressResponseDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', description: 'Address UUID' })
  @ApiNoContentResponse()
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addressesService.remove(req.user.sub, id);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Set an address as the default (idempotent)' })
  @ApiParam({ name: 'id', description: 'Address UUID' })
  @ApiOkResponse({ type: AddressResponseDto })
  setDefault(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addressesService.setDefault(req.user.sub, id);
  }
}

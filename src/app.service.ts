import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  async getHealth() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'petzi-backend',
        database: 'unavailable',
      });
    }

    return {
      status: 'ok',
      service: 'petzi-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}

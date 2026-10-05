import { Module } from '@nestjs/common';
import { G3WifiService } from './g3-wifi.service.js';

@Module({
  providers: [G3WifiService],
  exports: [G3WifiService],
})
export class G3WifiModule {}

import { Module } from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';

@Module({ providers: [FileProcessorService], exports: [FileProcessorService] })
export class MediaModule {}

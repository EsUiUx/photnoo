import { Module } from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';
import { ImageUploadService } from './image-upload.service';

@Module({ providers: [FileProcessorService, ImageUploadService], exports: [FileProcessorService, ImageUploadService] })
export class MediaModule {}

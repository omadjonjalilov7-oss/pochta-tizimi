import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentDto } from './create-document.dto';

// Faqat draft holatida tahrirlash mumkin
export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

// Bir nechta xabar ustida bitta amal (belgilab o'chirish va h.k.) uchun —
// tanlangan xabarlarning ID ro'yxati.
export class BulkIdsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];
}

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { QrApprovalService } from './qr-approval.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ApproveDocumentDto, ApproveOverdueDocumentDto, CommentDto, ExtendDeadlineDto, ForwardDto, RejectDto } from './dto/document-action.dto';
import { CompleteTargetDto, CreateResolutionDto } from './dto/resolution.dto';
import { SignDocumentDto } from './dto/sign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly qrApproval: QrApprovalService,
  ) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateDocumentDto) {
    return this.docs.create(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listMine(user.id);
  }

  @Get('drafts')
  listDrafts(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listDrafts(user.id);
  }

  @Get('tasks')
  listTasks(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listTasks(user.id);
  }

  @Get('executions')
  listExecutions(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listExecutions(user.id);
  }

  @Get('incoming')
  listIncoming(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listIncoming(user.id);
  }

  @Get('outgoing')
  listOutgoing(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listOutgoing(user.id);
  }

  @Get('archive')
  listArchive(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listArchive(user.id);
  }

  @Get('to-sign')
  listToSign(@CurrentUser() user: CurrentUserPayload) {
    return this.docs.listToSign(user.id);
  }

  // Bo'lim bo'yicha keyingi hujjat raqamini oldindan ko'rsatish (counter'ni oshirmaydi)
  @Get('next-number')
  previewNextNumber(@Query('deptId') deptId: string) {
    if (!deptId) return { number: null };
    return this.docs.previewNextNumber(deptId);
  }

  @Get('stats/mine')
  myStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.docs.getStats(user.id, from, to);
  }

  @Get('stats/global')
  globalStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!user.isAdmin) {
      throw new ForbiddenException("Global statistika faqat administrator uchun");
    }
    return this.docs.getGlobalStats(from, to);
  }

  @Get(':id/pdf')
  async exportPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.docs.exportPdf(user.id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  @Get(':id/signable-payload')
  getSignablePayload(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.docs.getSignablePayload(user.id, id);
  }

  @Post('resolution-target/:id/complete')
  completeTarget(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteTargetDto,
  ) {
    return this.docs.completeTarget(user.id, id, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.docs.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.docs.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.docs.remove(user.id, id);
  }

  @Post(':id/send')
  send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.docs.sendForApproval(user.id, id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveDocumentDto,
  ) {
    return this.docs.approve(user.id, id, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDto,
  ) {
    return this.docs.reject(user.id, id, dto);
  }

  @Post(':id/approve-overdue')
  approveOverdue(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveOverdueDocumentDto,
  ) {
    return this.docs.approveOverdueDocument(user.id, id, dto);
  }

  @Patch(':id/extend-deadline')
  extendDeadline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExtendDeadlineDto,
  ) {
    return this.docs.extendDeadline(user.id, id, dto);
  }

  @Post(':id/comment')
  comment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CommentDto,
  ) {
    return this.docs.addComment(user.id, id, dto);
  }

  @Post(':id/forward')
  forward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ForwardDto,
  ) {
    return this.docs.forward(user.id, id, dto);
  }

  @Post(':id/resolution')
  addResolution(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateResolutionDto,
  ) {
    return this.docs.addResolution(user.id, id, dto);
  }

  @Post(':id/sign')
  sign(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SignDocumentDto,
  ) {
    return this.docs.sign(user.id, id, dto);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.docs.uploadAttachment(user.id, id, file);
  }

  @Get(':id/attachments/:attId/download')
  async downloadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attId', new ParseUUIDPipe()) attId: string,
    @Res() res: Response,
  ) {
    const f = await this.docs.downloadAttachment(user.id, id, attId);
    res.set({
      'Content-Type': f.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Content-Length': String(f.sizeBytes),
    });
    createReadStream(f.fullPath).pipe(res);
  }

  @Delete(':id/attachments/:attId')
  deleteAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attId', new ParseUUIDPipe()) attId: string,
  ) {
    return this.docs.deleteAttachment(user.id, id, attId);
  }

  // ── QR TASDIQQA VA APPROVAL STATUS ──────────────────────────────

  @Get('approval-status')
  getApprovalStats(@CurrentUser() user: CurrentUserPayload) {
    return this.qrApproval.getAggregateApprovalStats(user.id);
  }

  @Get('approval-status/filter')
  filterByApprovalStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status: 'approved' | 'pending' | 'rejected' | 'partially_approved' = 'pending',
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.qrApproval.filterDocumentsByApprovalStatus(
      user.id,
      status,
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Get(':id/approval-status')
  getApprovalStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.qrApproval.getApprovalStatus(id);
  }

  @Patch(':id/approve-with-qr')
  approveWithQr(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { qrCode: string; participantId: string },
  ) {
    return this.docs.approveDocumentWithQr(user.id, id, dto.participantId, dto.qrCode);
  }

  @Patch(':id/reject-with-qr')
  rejectWithQr(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { qrCode: string; participantId: string; reason: string },
  ) {
    return this.docs.rejectDocumentWithQr(user.id, id, dto.participantId, dto.qrCode, dto.reason);
  }
}

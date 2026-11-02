import {
    Controller,
    Get,
    Param,
    Res,
    NotFoundException,
    UseInterceptors,
    Post,
    UploadedFile,
    Body, UseGuards,
    BadRequestException
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {FileInterceptor} from "@nestjs/platform-express";
import { UploadService } from './upload.service';
import { AuthGuard } from '@nestjs/passport';



@Controller('uploads')

export class UploadController {

    constructor(private readonly uploadService: UploadService) {}


    @UseGuards(AuthGuard('jwt'))
      @Post()
    @UseInterceptors(FileInterceptor('file'))
    async save(
        @UploadedFile() file: Express.Multer.File,
        @Body('prefix') prefix: string,
        @Body('folder') folder: string
    ) {
        try {
            


           
          

           
            const imageUrl = await this.uploadService.saveFile(prefix, folder, file);
            // 7) Retour
            return {
                data: imageUrl,
                message: "",
                status: 200
            };
        } catch (e) {
            console.log(e);
            throw new BadRequestException("Erreur lors de l'enregistrement du fichier");
        }
    }

    @Get(':folder/:filename')
    async getFile(
        @Param('folder') folder: string,
        @Param('filename') filename: string,
        @Res() res: Response,
    ) {
        const root = process.env.UPLOAD_ROOT;
        if (!root) {
            throw new Error("UPLOAD_ROOT n'est pas défini dans le .env");
        }

        // Chemin complet du fichier : un seul dossier et un seul nom, jamais en dehors de root
        // (les paramètres sont décodés, "..%2F" deviendrait sinon "../").
        const name = filename.replace(/\s+/g, "");
        const isPlainSegment = (value: string) => !!value && !/[\\/]/.test(value) && !value.startsWith('.');
        const rootDir = path.resolve(root);
        const filePath = path.resolve(rootDir, folder, name);
        if (!isPlainSegment(folder) || !isPlainSegment(name) || !filePath.startsWith(rootDir + path.sep)) {
            throw new NotFoundException("Fichier introuvable");
        }

        // Vérifie l'existence
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            throw new NotFoundException("Fichier introuvable");
        }

        // Envoie du fichier au client
        return res.sendFile(filePath);
    }


    @UseGuards(AuthGuard('jwt'))
    @Post()
    @UseInterceptors(FileInterceptor('file'))
    upload(
        @UploadedFile() file: Express.Multer.File,
        @Body('prefix') prefix: string,
        @Body('folder') folder: string,
    ) {
        const path = this.uploadService.saveFile(prefix, folder, file);

        return {
            message: 'Upload réussi',
            path: path
        };
    }
}

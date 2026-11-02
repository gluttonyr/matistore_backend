import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// One plain path segment (letters, digits, "-", "_", "." but no leading dot): no "..", no slashes, no hidden files.
export function safePathSegment(value: string | undefined): string | null {
    const segment = path.basename(String(value ?? '').trim());
    return /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(segment) ? segment : null;
}

@Injectable()
export class UploadService {

    saveFile(prefix: string | undefined, folderName: string, file: Express.Multer.File): string {

        if (!file) {
            throw new Error('Aucun fichier reçu');
        }

        // 1. Récupérer chemin racine hors projet
        const root = process.env.UPLOAD_ROOT;
        if (!root) {
            throw new Error('UPLOAD_ROOT non défini dans le fichier .env');
        }

        // 2. Construire le chemin final : root/folderName (un seul dossier, jamais en dehors de root)
        const folder = safePathSegment(folderName);
        if (!folder) {
            throw new Error('Dossier de destination invalide');
        }
        const uploadDir = path.join(root, folder);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 3. Extension du fichier
        const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');

        // 4. Timestamp
        const timestamp = Date.now();

        // 5. Nom final
        let finalName = '';
        if (prefix) {
            const safe = prefix.replace(/[^a-zA-Z0-9-_]/g, '');
            finalName = `${safe}-${timestamp}${ext}`;
        } else {
            const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9-_]/g, '') || 'file';
            finalName = `${base}-${timestamp}${ext}`;
        }

        // 6. Path absolu
        const finalPath = path.join(uploadDir, finalName);

        // 7. Écriture
        fs.writeFileSync(finalPath, file.buffer);

        // 8. Retour : chemin public (tu décideras du controller ensuite)
        return finalName;
    }

}

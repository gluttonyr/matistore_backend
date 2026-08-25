import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  getHello(): string {
    return this.appService.getHello();
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getHomePage(): string {
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MatiStore</title>
    <meta name="description" content="MatiStore, l'application mobile de commerce et de services.">
    <style>
      :root { color-scheme: light; font-family: Arial, sans-serif; color: #17202a; background: #f5f7fa; }
      body { margin: 0; }
      main { box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 56px 24px; text-align: center; }
      img { width: 112px; height: 112px; object-fit: contain; border-radius: 24px; }
      h1 { margin: 24px 0 12px; font-size: 2.2rem; }
      p { margin: 0 auto 28px; max-width: 560px; line-height: 1.6; }
      a { color: #1264a3; }
      .links { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <main>
      <img src="/assets/logo.png" alt="Logo MatiStore">
      <h1>MatiStore</h1>
      <p>MatiStore est une application mobile conçue pour faciliter l'accès aux produits et services proposés par notre plateforme.</p>
      <div class="links">
        <a href="https://play.google.com/store/apps/details?id=com.urbain_diligence.matistore_mobile">Télécharger l'application Android</a>
        <a href="/privacy-rule">Règles de confidentialité</a>
      </div>
    </main>
  </body>
</html>`;
  }

  @Get('privacy-rule')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy(): string {
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Règles de confidentialité | MatiStore</title>
    <style>
      :root { font-family: Arial, sans-serif; color: #17202a; background: #f5f7fa; }
      body { margin: 0; }
      main { box-sizing: border-box; max-width: 820px; margin: 0 auto; padding: 36px 24px 64px; background: #fff; min-height: 100vh; }
      header { display: flex; align-items: center; gap: 16px; margin-bottom: 36px; }
      header img { width: 64px; height: 64px; object-fit: contain; border-radius: 14px; }
      h1 { margin: 0; font-size: 1.8rem; }
      h2 { margin-top: 32px; font-size: 1.2rem; }
      h3 { margin-top: 24px; font-size: 1.05rem; }
      p, li { line-height: 1.65; }
      li { margin: 8px 0; }
      a { color: #1264a3; }
      .updated { color: #5f6b76; font-size: .95rem; }
    </style>
  </head>
  <body>
    <main>
      <header><img src="/assets/logo.png" alt="Logo MatiStore"><h1>Règles de confidentialité</h1></header>
      <p class="updated">Dernière mise à jour : 3 août 2026</p>
      <p>Cette politique de confidentialité décrit nos politiques et procédures concernant la collecte, l'utilisation et la divulgation de vos informations lorsque vous utilisez le Service. Elle vous informe également de vos droits en matière de confidentialité et de la manière dont la loi vous protège.</p>
      <p>Nous utilisons vos données personnelles pour fournir et améliorer le Service. Nous collectons, utilisons et divulguons vos informations comme décrit dans cette politique et, lorsque la loi l'exige, uniquement avec une base légale valide, notamment votre consentement lorsque celui-ci est requis.</p>
      <h2>Interprétation et définitions</h2>
      <h3>Interprétation</h3>
      <p>Les mots dont la première lettre est en majuscule ont une signification définie dans les conditions suivantes. Ces définitions ont le même sens qu'elles soient au singulier ou au pluriel.</p>
      <h3>Définitions</h3>
      <ul>
        <li><strong>Compte</strong> désigne un compte unique créé pour vous permettre d'accéder à notre Service ou à certaines de ses parties.</li>
        <li><strong>Application</strong> désigne le logiciel MatiStore fourni par la Société.</li>
        <li><strong>Société</strong>, également désignée par « Nous », « Notre » ou « Nos », désigne MatiStore.</li>
        <li><strong>Pays</strong> désigne le Togo.</li>
        <li><strong>Appareil</strong> désigne tout appareil pouvant accéder au Service, tel qu'un ordinateur, un téléphone ou une tablette.</li>
        <li><strong>Données personnelles</strong> désigne toute information se rapportant à une personne identifiée ou identifiable.</li>
        <li><strong>Service</strong> désigne l'Application.</li>
        <li><strong>Fournisseur de services</strong> désigne toute personne physique ou morale qui traite les données pour le compte de la Société afin de faciliter ou d'analyser l'utilisation du Service.</li>
        <li><strong>Données d'utilisation</strong> désigne les données collectées automatiquement lors de l'utilisation du Service ou générées par son infrastructure.</li>
        <li><strong>Utilisateur</strong> désigne toute personne qui accède au Service ou l'utilise.</li>
        <li><strong>Vous</strong> désigne la personne qui accède au Service ou l'utilise, ou l'entité pour laquelle elle agit.</li>
      </ul>
      <h2>Collecte et utilisation de vos informations personnelles</h2>
      <h3>Types de données collectées</h3>
      <p>Lorsque vous utilisez notre Service, nous pouvons vous demander certaines informations personnelles permettant de vous contacter ou de vous identifier, notamment :</p>
      <ul><li>Adresse e-mail</li><li>Prénom et nom</li><li>Numéro de téléphone</li></ul>
      <h3>Données d'utilisation</h3>
      <p>Les données d'utilisation sont collectées automatiquement. Elles peuvent inclure l'adresse IP, le type et la version du navigateur, les pages consultées, la date et la durée des visites, les identifiants uniques de l'appareil et les données de diagnostic. Sur appareil mobile, nous pouvons également collecter le type d'appareil, son identifiant, son système d'exploitation et le type de navigateur mobile.</p>
      <h3>Informations collectées lors de l'utilisation de l'Application</h3>
      <p>Pour fournir certaines fonctionnalités, nous pouvons collecter, avec votre autorisation préalable, des photos et d'autres informations provenant de l'appareil photo ou de la bibliothèque de photos de votre appareil. Ces informations peuvent être téléversées sur nos serveurs ou ceux d'un fournisseur de services, ou rester stockées sur votre appareil. Vous pouvez activer ou désactiver ces autorisations dans les réglages de votre appareil.</p>
      <h3>Technologies de suivi et cookies</h3>
      <p>Nous pouvons utiliser des technologies de suivi, telles que les cookies, afin de suivre l'activité et d'améliorer le Service.</p>
      <h3>Utilisation de vos données personnelles</h3>
      <ul>
        <li>Fournir et maintenir notre Service, notamment surveiller son utilisation.</li>
        <li>Gérer votre Compte et votre inscription.</li>
        <li>Exécuter les contrats concernant les produits, articles ou services achetés.</li>
        <li>Vous contacter par e-mail, téléphone, SMS ou notifications push pour les mises à jour, informations et alertes de sécurité.</li>
        <li>Vous envoyer des actualités et offres lorsque la loi l'autorise, avec votre consentement lorsque celui-ci est requis. Vous pouvez vous désinscrire à tout moment.</li>
        <li>Gérer vos demandes et fournir l'assistance.</li>
        <li>Réaliser des opérations de restructuration, fusion, cession ou transfert d'actifs.</li>
        <li>Analyser l'utilisation, identifier les tendances et améliorer nos produits, services et communications.</li>
      </ul>
      <h3>Partage de vos données personnelles</h3>
      <ul>
        <li><strong>Avec les fournisseurs de services</strong>, pour surveiller et analyser l'utilisation du Service ou vous contacter.</li>
        <li><strong>Dans le cadre de transferts d'entreprise</strong>, notamment une fusion, une vente d'actifs, un financement ou une acquisition.</li>
        <li><strong>Avec nos sociétés affiliées</strong>, qui doivent respecter cette politique.</li>
        <li><strong>Avec d'autres utilisateurs</strong>, lorsque vous publiez des informations dans des espaces publics du Service.</li>
        <li><strong>Avec votre consentement</strong>, pour toute autre finalité.</li>
      </ul>
      <h3>Notification relative aux SMS</h3>
      <p>Si vous choisissez de recevoir des SMS, nous pouvons conserver votre numéro, la date et le mode de votre consentement ainsi que les informations de livraison. Les informations mobiles ne sont ni vendues ni partagées à des fins marketing. Votre consentement n'est pas une condition d'achat ou d'utilisation du Service. Les messages peuvent concerner l'assistance, votre compte, les livraisons, l'authentification, la sécurité ou des offres promotionnelles. Répondez STOP pour vous désinscrire et HELP pour obtenir de l'aide. Des frais de message et de données peuvent s'appliquer.</p>
      <h2>Conservation de vos données personnelles</h2>
      <p>Nous conservons vos données uniquement pendant la durée nécessaire aux finalités décrites dans cette politique, au respect de nos obligations légales, au règlement des litiges et à l'application de nos accords. Lorsque cela est possible, nous réduisons les durées de conservation et l'identifiabilité des données par suppression, agrégation ou anonymisation.</p>
      <ul><li>Informations de compte : pendant la relation avec votre compte, puis jusqu'à 24 mois après sa fermeture.</li><li>Demandes d'assistance et correspondances : jusqu'à 24 mois après leur clôture.</li><li>Statistiques d'utilisation et journaux serveur : jusqu'à 24 mois, sauf nécessité de sécurité, de prévention de la fraude ou de conformité légale.</li></ul>
      <p>À l'expiration des durées, les données sont supprimées ou anonymisées. Des copies chiffrées peuvent subsister temporairement dans les sauvegardes conformément à notre calendrier de conservation.</p>
      <h2>Transfert de vos données personnelles</h2>
      <p>Vos informations peuvent être traitées dans les bureaux de la Société ou dans d'autres lieux où se trouvent les parties chargées du traitement. Lorsque la loi l'exige, nous appliquons des garanties appropriées aux transferts internationaux et prenons les mesures raisonnables pour protéger vos données.</p>
      <h2>Suppression de vos données personnelles</h2>
      <p>Vous pouvez demander l'accès, la mise à jour, la correction ou la suppression de vos données depuis les réglages du compte lorsque cette fonctionnalité est disponible, ou en nous contactant. Nous pouvons conserver certaines informations lorsque la loi ou une base légale l'exige.</p>
      <h2>Divulgation de vos données personnelles</h2>
      <p>Nous pouvons divulguer vos données dans le cadre d'une transaction commerciale, pour respecter une obligation légale, protéger les droits ou les biens de la Société, prévenir une activité illicite, protéger la sécurité des utilisateurs ou nous défendre contre une responsabilité juridique.</p>
      <h2>Sécurité de vos données personnelles</h2>
      <p>La sécurité de vos données est importante pour nous. Toutefois, aucune méthode de transmission ou de stockage électronique n'est totalement sûre. Nous mettons en œuvre des moyens raisonnables pour protéger vos informations sans pouvoir garantir une sécurité absolue.</p>
      <h2>Vie privée des enfants et des mineurs</h2>
      <p>Le Service ne s'adresse pas aux personnes de moins de 16 ans et nous ne collectons pas sciemment leurs données personnelles. Si nous découvrons qu'une telle collecte a eu lieu, nous prendrons les mesures nécessaires pour supprimer ces informations.</p>
      <h2>Liens vers d'autres sites</h2>
      <p>Notre Service peut contenir des liens vers des sites tiers. Nous vous recommandons de consulter leur politique de confidentialité. Nous ne contrôlons pas leurs contenus, politiques ou pratiques.</p>
      <h2>Modifications de cette politique</h2>
      <p>Nous pouvons mettre à jour cette politique de temps à autre. Les modifications seront publiées sur cette page et la date de mise à jour sera modifiée. Nous pouvons également vous informer par e-mail ou par une notification visible lorsque cela est nécessaire.</p>
      <h2>Nous contacter</h2>
      <p>Pour toute question concernant cette politique, contactez-nous par e-mail : <a href="mailto:koufessirolland@gmail.com">koufessirolland@gmail.com</a>.</p>
      <p><a href="/">Retour à la page d'accueil de MatiStore</a></p>
    </main>
  </body>
</html>`;
  }

  @Get('assets/logo.png')
  getLogo(@Res() response: Response): void {
    response.sendFile(join(__dirname, '../assets/logo.png'));
  }
}

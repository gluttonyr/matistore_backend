<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Bookmakers (1XBET, MELBET)

The app's first deposit and withdrawal step lists the `bookmakers` table (`GET /bookmakers`): name, logo (`uploads/bookmakers`), site, app links and `active`. An inactive bookmaker is shown greyed out ("Bientôt disponible") and refused by the server. Each transaction stores its `bookmaker`; apps without the choice send none and get 1XBET.

Each bookmaker calls the same cash-desk API with its own keys:

| Bookmaker | Variables |
|---|---|
| 1XBET | `SERVCUL_HASH`, `SERVCUL_CASHIER_PASS`, `SERVCUL_CASHDESK_ID`, `SERVCUL_API_BASE_URL` (optional) |
| MELBET | `MELBET_HASH`, `MELBET_CASHIER_PASS`, `MELBET_CASHDESK_ID`, `MELBET_API_BASE_URL` (required) |

To switch MELBET on: fill the four `MELBET_*` variables, redeploy, then `UPDATE bookmakers SET active = true WHERE code = 'MELBET';`. No app update is needed. First deployment of this feature: run `migrations/20261120-bookmakers.sql` before deploying.

## Temporary public Servcul test routes

These unauthenticated routes call the live Servcul API directly. They can credit a real player account or execute a real payout. Use only for the requested Postman test, then remove them before pushing or deploying the backend.

Replace `{{baseUrl}}` with the backend URL. Send `Content-Type: application/json`.

### Test a player deposit

`POST {{baseUrl}}/servcul/test/deposit`

```json
{
  "userId": 1829816113,
  "amount": 1000
}
```

### Test a player withdrawal

Servcul requires the player's withdrawal code, not a requested amount. Its response contains the payout amount.

`POST {{baseUrl}}/servcul/test/withdrawal`

```json
{
  "userId": 1829816113,
  "code": "PLAYER_WITHDRAWAL_CODE"
}
```

Inspect the backend logs for `servcul.deposit.add.*` or `servcul.deposit.payout.*` to see Servcul's HTTP status and sanitized response body.

## Referral tournament (`src/referral`)

Run `migrations/20261121-referral-tournament.sql` on the production database before deploying (synchronize is off there).

- A client gets a referral code (`POST /referral/code`) only after a first validated deposit; the code never changes.
- A filleul counts for his **current** parrain once he has made `depositsRequired` validated deposits of at least `minAmount` during the round, counting only deposits made since he chose that parrain. Changing parrain (`POST /referral/parrain`) removes the referral from the old parrain at once. Ties go to whoever reached the score first.
- The admin sets duration, number of winners, prizes (money, or a lot with a photo in the uploads folder `referral`), deposits required and minimum amount (`PUT /admin/referral/settings`). Changes apply to the next round; the running round keeps the copy it was created with. Turning the tournament off cancels the running round (no winners).
- Rounds end at midnight UTC (Lomé time) once their duration has passed; the next one starts on its own. A check runs every 30 s. Winners get a message in their deposit chat (with the push) and an in-app notification; marking a winner rewarded (`POST /admin/referral/winners/:id/rewarded`) tells them too.
- Each validated deposit emits the socket event `referralRankingChanged`; round changes emit `referralRoundChanged`.
- Client: `GET /referral/me`, `GET /referral/tournament`, `GET /referral/lookup?code=`, `POST /referral/prompt-seen`. Admin: `GET /admin/referral/settings`, `GET /admin/referral/rounds`, `GET /admin/referral/stats`.

## Coupons du jour (`src/coupon`)

Run `migrations/20261121-coupons.sql` on the production database before deploying (it also adds `app_notifications.link`).

- The admin publishes a coupon: a screenshot (uploads folder `coupons`, stored as its full URL) and one code per bookmaker of the `bookmakers` table (`POST /admin/coupons`). Unless `notify: false`, every client gets an in-app notification linked to the coupon (`link = "coupon:<id>"`, returned with the coupon in `GET /app-notifications`) and a push (`data.type = "COUPON"`).
- `PATCH /admin/coupons/:id/status` sets `EN_COURS`, `GAGNE` or `PERDU`; `DELETE /admin/coupons/:id` removes it. Every change emits the socket event `couponsChanged`.
- Clients: `GET /coupons/home` (today's coupons, UTC, else the last 5), `GET /coupons?before=&limit=` (newest first), `GET /coupons/:id`.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

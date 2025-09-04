## [2.0.1](https://github.com/abdul-hamid-achik/dev-atlas/compare/v2.0.0...v2.0.1) (2025-09-04)


### Bug Fixes

* apply code formatting fixes for website ([637cdb5](https://github.com/abdul-hamid-achik/dev-atlas/commit/637cdb5aa39de415e8d604ba0435f5b15767d074))
* update knowledge graph directory path in website configuration ([de229a9](https://github.com/abdul-hamid-achik/dev-atlas/commit/de229a9ec80c57546c2181b75fdc96f228ea34e5))

# [2.0.0](https://github.com/abdul-hamid-achik/dev-atlas/compare/v1.0.0...v2.0.0) (2025-09-04)


### Bug Fixes

* add missing database methods for VSCode extension ([bbc491d](https://github.com/abdul-hamid-achik/dev-atlas/commit/bbc491db3e310503f0720e67fba7a90e6f72e023))
* improve Ollama service container reliability in CI ([dfc32a5](https://github.com/abdul-hamid-achik/dev-atlas/commit/dfc32a518930245300f2a4ff497256019f0dd291))
* include package-lock.json for reproducible CI builds ([9bfe39a](https://github.com/abdul-hamid-achik/dev-atlas/commit/9bfe39aa36736c9a2cd41a48e0ac53c5b4db67a7))
* remove automatic npm cache from setup-node action ([f77d8b2](https://github.com/abdul-hamid-achik/dev-atlas/commit/f77d8b25a3f37a0fa58cad668a2985bd59f1ac0c))
* Remove sqlite-vec dependency that was causing build failures ([d07f9b5](https://github.com/abdul-hamid-achik/dev-atlas/commit/d07f9b558d2f52e289c9e2a4dd00245b11a84711))
* resolve all linting errors in CI pipeline ([52811cc](https://github.com/abdul-hamid-achik/dev-atlas/commit/52811cce88d573e4898b7ce5f763ac8146d0b61a))
* resolve final formatting issues for CI ([382a225](https://github.com/abdul-hamid-achik/dev-atlas/commit/382a225c2eafaf568c804af8f0b5619a735848b3))
* resolve Node.js module compatibility and MCP configuration issues ([8a263b2](https://github.com/abdul-hamid-achik/dev-atlas/commit/8a263b25fcdd12d643eb7dc28a909e5ef88e9da2))
* resolve Ollama container initialization failures in CI ([b0f2579](https://github.com/abdul-hamid-achik/dev-atlas/commit/b0f2579544423a292f9c709007877c28bab0b913))
* sync package-lock.json and remove Node.js 18 from CI matrix ([00c4c23](https://github.com/abdul-hamid-achik/dev-atlas/commit/00c4c2366d4edbeaae5687841be82fb8385fb35d))
* temporarily exclude website to unblock release pipeline ([ffc4744](https://github.com/abdul-hamid-achik/dev-atlas/commit/ffc47444839622ffa8f73f919b34eb933e850ba2))
* use npm install instead of npm ci in workflow ([8360cda](https://github.com/abdul-hamid-achik/dev-atlas/commit/8360cdac9fd57ef9390ae7e6fe0949511f5bcb48))


### Features

* Add local-first AI embedding with Ollama + VS Code vector search ([163a846](https://github.com/abdul-hamid-achik/dev-atlas/commit/163a846f199cf067466c4d09abc2694cec716079))
* Add vector search and smart merging to MCP knowledge graph ([2084693](https://github.com/abdul-hamid-achik/dev-atlas/commit/208469389d5d570a325f0e1038fa4d75d9376989))
* comprehensive linting fixes and type safety improvements ([06b005e](https://github.com/abdul-hamid-achik/dev-atlas/commit/06b005ed4dab0b807f3f54a5c4f2657f9866d033))
* implement comprehensive file explorer integration ([da1699d](https://github.com/abdul-hamid-achik/dev-atlas/commit/da1699dd83e1d2b92349d1871f06e8ee8c3678a6))
* integrate Ollama embedding service into CI workflow and enhance embedding model validation ([7d3bd1a](https://github.com/abdul-hamid-achik/dev-atlas/commit/7d3bd1a65e226395a07b0dafecde93a573cb10f9))


### BREAKING CHANGES

* Default provider changed to local Ollama for privacy
* Database schema updated with embedding columns

# 1.0.0 (2025-09-03)


### Bug Fixes

* resolve all build issues across packages ([ddbcd6f](https://github.com/abdul-hamid-achik/dev-atlas/commit/ddbcd6fb42aca4328ef78313a3bee249773d9d72))
* update import path for ThemeProviderProps in theme-provider component ([203b576](https://github.com/abdul-hamid-achik/dev-atlas/commit/203b576cd2545f562cc65987e81660d05105271b))
* update publisher ID to match marketplace account (abdulachik) ([aa4b9ca](https://github.com/abdul-hamid-achik/dev-atlas/commit/aa4b9ca2a2e98c956438a8fdcfb839e94a2a4535))


### Features

* add .vscodeignore to optimize extension packaging ([d0014dc](https://github.com/abdul-hamid-achik/dev-atlas/commit/d0014dca8325114f0dccb76ff568e30861ab87a9))
* add initial implementation of Knowledge Graph database and VS Code extension features ([c8886ae](https://github.com/abdul-hamid-achik/dev-atlas/commit/c8886ae437d1c986451ba333597af73829c2ded2))
* add KNOWLEDGE_GRAPH_DIR environment variable support ([8a62790](https://github.com/abdul-hamid-achik/dev-atlas/commit/8a62790e51c74604d3b9c89d5932d6c801939490))
* add startup logging for database path debugging ([5fc6d45](https://github.com/abdul-hamid-achik/dev-atlas/commit/5fc6d45c76218d1c79a9e187884f1c11cf3b0f88))
* complete package namespacing and maintain Nextra 3.0.0 ([479ef7c](https://github.com/abdul-hamid-achik/dev-atlas/commit/479ef7c6d47b4200d1aed2d2388fbe403fa98177))
* enhance Knowledge Graph functionality with new operations and analytics ([9e124d9](https://github.com/abdul-hamid-achik/dev-atlas/commit/9e124d99229748303873f72a0b46af573fad0b15))
* enhance KnowledgeGraphDB and VSCode extension with improved type safety and property handling ([188edd8](https://github.com/abdul-hamid-achik/dev-atlas/commit/188edd86e98d42086a8130974ed8611c3cf70db6))
* enhance KnowledgeGraphDB with improved SQLite configuration and retry logic ([6dc61aa](https://github.com/abdul-hamid-achik/dev-atlas/commit/6dc61aa8e0a8711415bb79cfb1f47a1c836dd05b))
* enhance VS Code extension with logging and database integration ([056d4bf](https://github.com/abdul-hamid-achik/dev-atlas/commit/056d4bf2beb1f31a5cf6c7dbddadb328c1a44e04))
* enhance website and VS Code extension with new components and features ([d1d58b3](https://github.com/abdul-hamid-achik/dev-atlas/commit/d1d58b38cb6532b9ef39eb9d061d816dc98c5a96))
* improve database path resolution to use project root ([239c155](https://github.com/abdul-hamid-achik/dev-atlas/commit/239c155ae9f23dbf089c5d662a06b52fffc3bb32))
* initial project setup with MCP server, VS Code extension, and documentation website ([2d0613e](https://github.com/abdul-hamid-achik/dev-atlas/commit/2d0613e3cd0f4cf38dfd69e24fa529e8dd3dac0a))
* integrate Zod schemas for enhanced type safety in KnowledgeGraphDB ([a956dbb](https://github.com/abdul-hamid-achik/dev-atlas/commit/a956dbb809e1bd384ff2d876f34255b8ca3516b4))
* migrate website to Next.js 15 App Router ([13af97e](https://github.com/abdul-hamid-achik/dev-atlas/commit/13af97ece49c0d5a7ec85d0c2611579f00f8a71a))
* setup CI/CD pipelines and semantic releases ([5817e32](https://github.com/abdul-hamid-achik/dev-atlas/commit/5817e321b3a7002ce7dbc3550e168ec043728c8f))
* update VS Code extension and Knowledge Graph database functionality ([20a28b9](https://github.com/abdul-hamid-achik/dev-atlas/commit/20a28b9188c9aca8a08d14f8680b7b374d0c13e5))

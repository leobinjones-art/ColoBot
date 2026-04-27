# Changelog

## [0.2.0](https://github.com/leobinjones-art/ColoBot/compare/v0.1.0...v0.2.0) (2026-04-27)


### Features

* add @colobot/server package and enhance core modules ([a286c1f](https://github.com/leobinjones-art/ColoBot/commit/a286c1f9441c3416fa5b602e0297c70f28d5bf94))
* add AI-powered academic task detection and improve SOP flow ([349b955](https://github.com/leobinjones-art/ColoBot/commit/349b9559e8b51f1842f408a9f9b08043b59e9078))
* add chat commands for approval management ([4c7e48a](https://github.com/leobinjones-art/ColoBot/commit/4c7e48aa24c35cd00185855b6a98d67a5b0002b9))
* add ClawHub compatibility layer (bidirectional) ([f058c71](https://github.com/leobinjones-art/ColoBot/commit/f058c712a022b5caeed287ba494ba8bc399b38b2))
* add ColoBotRuntime interface and @colobot/sop-academic package ([eca2c29](https://github.com/leobinjones-art/ColoBot/commit/eca2c295f8281da0a7cd72139235e8e6ec0dedb6))
* add configurable SOP system with dashboard editing ([38970ff](https://github.com/leobinjones-art/ColoBot/commit/38970ffddf4279f74283fa2293c7cba0717f1585))
* add database persistence support ([2960db9](https://github.com/leobinjones-art/ColoBot/commit/2960db9f6969197cbb6c2debaad822acac2bc3d2))
* add Feishu long polling support (无需公网IP) ([f147289](https://github.com/leobinjones-art/ColoBot/commit/f147289f51d02d0902dd9b134ff20ca1c0e4ee79))
* add install_skill tool for Agent self-service ([c1badd4](https://github.com/leobinjones-art/ColoBot/commit/c1badd48513ebe0bb30f216927bd3d9d75aad753))
* add LLM test connection and model list APIs ([a9b1316](https://github.com/leobinjones-art/ColoBot/commit/a9b13164311d9ccbe50aa8b8363d8d6a6ffca971))
* add user profile auto-evolution ([2f0c192](https://github.com/leobinjones-art/ColoBot/commit/2f0c192d9b8aa3b8fee43174d81945b6b97f82f1))
* add user profile system with dashboard UI ([a1b18c6](https://github.com/leobinjones-art/ColoBot/commit/a1b18c69a20ffac4f84a65255f2961cfe4702acf))
* AI-driven dynamic SOP responses with i18n support ([1b9975a](https://github.com/leobinjones-art/ColoBot/commit/1b9975af654a873f171924c6a3c7900e9c66e76c))
* AI-driven SOP flow with research purpose selection ([29e3077](https://github.com/leobinjones-art/ColoBot/commit/29e3077275a8703e815f889745c4934565fb486e))
* complete poisoning defense system ([278da6a](https://github.com/leobinjones-art/ColoBot/commit/278da6aee85e503878d389eef0a037c38ad3f47a))
* complete Skill management functionality ([4cb3356](https://github.com/leobinjones-art/ColoBot/commit/4cb33560b2eb05baef643be81ae8267af68a1b82))
* **core:** add MiniMax/Mock providers and Fallback chain ([084731c](https://github.com/leobinjones-art/ColoBot/commit/084731c2967716d3434a7bf1135c1110bad3e7da))
* **core:** add SQLite store adapter for PostgreSQL fallback ([7adffd3](https://github.com/leobinjones-art/ColoBot/commit/7adffd3bb8622913d67b8308a9eb0b50424103d0))
* implement AI-driven dynamic SOP flow ([4fd26d9](https://github.com/leobinjones-art/ColoBot/commit/4fd26d991631027b397780adee37b4eab98bd83f))
* implement SOP self-optimization (C + D) ([2412ce5](https://github.com/leobinjones-art/ColoBot/commit/2412ce57f77bd55cd0631e58b7cb3b49ba1737e3))
* integrate safe-write into self-evolution systems ([f55d0a4](https://github.com/leobinjones-art/ColoBot/commit/f55d0a42cfec615a57ad8590f3d75e43ef4bfe84))
* integrate Skill evolution into runtime ([533f8b2](https://github.com/leobinjones-art/ColoBot/commit/533f8b225d6a90803651aceabfc979c812567be1))
* monorepo restructuring with @colobot/core, @colobot/types, @colobot/tui ([ec4680c](https://github.com/leobinjones-art/ColoBot/commit/ec4680c681d5aafd0b8747ff8bdaa3f4e6e076e2))
* use AI to generate task breakdown and operation manual in SOP ([cd2ed07](https://github.com/leobinjones-art/ColoBot/commit/cd2ed07ae060f162d332a8c76a1c6881e0accf6a))


### Bug Fixes

* add debug logging to SOP flow ([c37e3b1](https://github.com/leobinjones-art/ColoBot/commit/c37e3b1afdcdfa76d1ee1d405290eac6bc1c7947))
* add domain parameter for Feishu long polling ([d1cd507](https://github.com/leobinjones-art/ColoBot/commit/d1cd507cf50ff14fcc429bbf8893e6b192736ebb))
* add missing callback URL field in Feishu settings ([d9e6892](https://github.com/leobinjones-art/ColoBot/commit/d9e68925769006f30e7c2f03e12727ba6193fe25))
* address code logic errors and edge cases ([e2a9268](https://github.com/leobinjones-art/ColoBot/commit/e2a9268ecbebc2d03759688db3a6efb5fb0287b8))
* improve Feishu long polling error message ([3ff33d1](https://github.com/leobinjones-art/ColoBot/commit/3ff33d1824d2d95b6145439062021fc39149068d))
* improve SOP flow completion and final output generation ([49e217c](https://github.com/leobinjones-art/ColoBot/commit/49e217ce79ea797a3405685eb862f5ec1c417868))
* improve SOP flow step progression and confirmation detection ([8d58e1e](https://github.com/leobinjones-art/ColoBot/commit/8d58e1e4457c6a44dbf6d7bef04f1d790eb8824e))
* rename @colobot/llm-minimax to @colobot/tools-minimax ([111563b](https://github.com/leobinjones-art/ColoBot/commit/111563b4b40330d1e2122f84a36e43be1f2e3d1f))
* resolve TypeScript compilation errors in packages ([6110f16](https://github.com/leobinjones-art/ColoBot/commit/6110f16f8410a9c62cfcab2ac83d98352cab6543))
* skip content safety scan for SOP responses ([c26a28a](https://github.com/leobinjones-art/ColoBot/commit/c26a28a71aafebf032e7a423cd9a9ecc010382a4))
* update sop.test.ts for new content-policy structure ([75538c0](https://github.com/leobinjones-art/ColoBot/commit/75538c02fe59f185a1250f9de64144adee2bd8b5))
* update tests for correct API methods and responses ([a77f826](https://github.com/leobinjones-art/ColoBot/commit/a77f826533a89322e85f91c583006b5e8645e5f3))

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Release notes generated by release-please. -->

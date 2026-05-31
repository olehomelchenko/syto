# Claude Context - Syto Project

See @AGENTS.md for project overview, security requirements, codebase orientation, and AI developer protocol.

---

## Documentation Index

### Project Vision

- **[SOUL.md](SOUL.md)**: Project philosophy, core values, and design principles — _read this first_

### Core Specifications

- **[SPECIFICATION.md](docs/SPECIFICATION.md)**: Technical architecture, codebase map, and implementation details
- **[DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)**: Data structures, transform format, expression syntax, and persistence
- **[UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)**: UI/UX design guidelines, component patterns, and theming system
- **[UI-VOCAB.md](docs/UI-VOCAB.md)**: UI terminology, design vocabulary, and recommended patterns for UI work
- **[FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)**: Schema evolution constraints and persistence compatibility

### Architecture Review

- **[ARCHITECTURE-REVIEW.md](docs/ARCHITECTURE-REVIEW.md)**: Critical review of extensibility friction — prioritized findings and recommendations

### Development Guides

- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)**: How to add transforms, testing patterns, state management conventions
- **[TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)**: Testing principles, diagnostic questions, failure modes, and audit protocol — _read before adding or evaluating tests_
- **[I18N-GUIDE.md](docs/I18N-GUIDE.md)**: Internationalization setup — adding languages, namespaces, plural rules, common patterns
- **[FUNCTION-DOCS-SYSTEM.md](docs/FUNCTION-DOCS-SYSTEM.md)**: Auto-generated function documentation system (JSDoc → markdown/JSON)
- **[DEBUGGING.md](docs/DEBUGGING.md)**: CSS Module debugging and DevTools tips
- **[BACKLOG.md](docs/BACKLOG.md)**: Active feature backlog (near-term planned work)
- **[TRANSFORM-ARCHITECTURE-REVIEW.md](docs/TRANSFORM-ARCHITECTURE-REVIEW.md)**: Transform design analysis and improvement roadmap
- **[MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)**: Dependency graph system, staleness tracking, and multi-model operations
- **[DATE-STORAGE-ARCHITECTURE.md](docs/DATE-STORAGE-ARCHITECTURE.md)**: Date/datetime handling strategy, JavaScript Date pitfalls, and developer rules

### Reference

- **[docs/arquero/](docs/arquero/)**: Arquero library documentation (verbs, expressions, operators)
- **[DECISIONS.md](docs/DECISIONS.md)**: Architecture Decision Records
- **[docs/future/](docs/future/)**: Future roadmap documents (CLI, native app, monetization, example workflows)
- **[CHANGELOG.md](docs/CHANGELOG.md)**: Historical record of completed features and improvements

---

## Quick Reference

| Topic                  | Where to Look                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Data structures        | [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md) §1-3                                                 |
| Expression syntax      | [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md) §4                                                   |
| Expression functions   | [FUNCTION-DOCS-SYSTEM.md](docs/FUNCTION-DOCS-SYSTEM.md)                                                  |
| How transforms work    | [SPECIFICATION.md](docs/SPECIFICATION.md) §3, §5                                                         |
| Adding new transforms  | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §1                                               |
| Architecture review    | [ARCHITECTURE-REVIEW.md](docs/ARCHITECTURE-REVIEW.md)                                                    |
| Testing patterns       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §3                                               |
| Testing strategy       | [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)                                                          |
| State management       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §2                                               |
| UI component patterns  | [UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md) §3                                                       |
| UI vocabulary & terms  | [UI-VOCAB.md](docs/UI-VOCAB.md)                                                                          |
| Content & writing      | [CONTENT-GUIDELINES.md](docs/CONTENT-GUIDELINES.md)                                                      |
| What's safe to change  | [FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)                                                            |
| Date handling rules    | [DATE-STORAGE-ARCHITECTURE.md](docs/DATE-STORAGE-ARCHITECTURE.md)                                        |
| Adding tool pages      | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §10                                              |
| Site structure         | [SPECIFICATION.md](docs/SPECIFICATION.md) §3.5                                                           |
| CSS debugging          | [DEBUGGING.md](docs/DEBUGGING.md)                                                                        |
| Architecture decisions | [docs/DECISIONS.md](docs/DECISIONS.md)                                                                   |
| CLI & workflow v2      | [SPECIFICATION.md](docs/SPECIFICATION.md) §3.6, [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md) §7.2 |
| Multi-model & chaining | [MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)                                          |
| Versioning & release   | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §11, [AGENTS.md](AGENTS.md) §Versioning          |
| DuckDB experimental    | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §12                                              |
| Adding a setting       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §2.3                                             |
| Project philosophy     | [SOUL.md](SOUL.md)                                                                                       |

---

## Documentation Maintenance

> **Important**: Keep this file stable. Avoid volatile details (specific counts, file lists, line numbers) that become outdated as the codebase evolves. Delegate specifics to the referenced documents below and update them instead.

When editing project documentation:

- **CLAUDE.md**: High-level orientation only. No specific file counts, component lists, or implementation details.
- **AGENTS.md**: Shared project context for all AI tools. Keep in sync with CLAUDE.md shared sections.
- **SPECIFICATION.md**: Technical architecture, codebase structure, implementation details.
- **DATA-SPECIFICATION.md**: Data structures, transform schemas, expression syntax, persistence format.
- **UX-SPECIFICATION.md**: UI patterns, component catalog, styling details.

---

**End of Context**

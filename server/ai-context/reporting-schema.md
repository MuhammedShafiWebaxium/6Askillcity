# 6A AI Reporting Context

This document explains the reporting architecture for developers. The
machine-readable source of truth used in AI prompts is
`server/services/report-catalog.js`.

## Request flow

1. Route the user's question to one or two reporting domains.
2. Load only those domains from the machine-readable catalog.
3. Ask the model for a structured report plan.
4. Normalize and validate the plan against canonical enums and business rules.
5. Execute the plan through a predefined backend query runner.
6. Ask the model to summarize only the validated plan and returned rows.

The model never receives database credentials and never generates executable
MongoDB.

## Domains

### Tickets

- Collections: `Ticket`
- Reports: status counts and record-level details
- Topic means `title` plus `description`
- Active/open/new means the canonical status `Received`

### Documents & Services

- Collections: `ServiceApplication`, `Student`, `AdmissionPoint`
- Relationship:
  `ServiceApplication.student -> Student.registeredBy -> AdmissionPoint`
- Partner filters must resolve to a real admission point
- Counts use each student's latest service application

### University Management

- Collections: `University`, `Program`, `Branch`
- Relationships:
  `Program.university -> University` and `Branch.program -> Program`
- Names, program types, modes, branch types, and activity states are validated
  against the catalog

### Payments

- Collections: `Student`, `Payment`
- Course-fee completion uses `Student.paymentStatus`
- Transaction summaries use `Payment`

### Students

- Collection: `Student`
- Reports: application status and registration trends

### Partners

- Collections: `Student`, `AdmissionPoint`
- Performance is measured from `Student.registeredBy`

## Maintenance

When a model field, enum, relationship, or business definition changes:

1. Update the Mongoose model.
2. Update the corresponding domain in `report-catalog.js`.
3. Update its deterministic query runner in `report-ai.service.js`.
4. Add routing and normalization validation cases.
5. Update this developer document when the conceptual behavior changes.

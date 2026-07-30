const freezeList = (values) => Object.freeze(values);

const ticketStatuses = freezeList([
  "Received",
  "On Progress",
  "Postponed",
  "Closed",
  "Reopened",
]);

const ticketStatusAliases = Object.freeze({
  active: "Received",
  open: "Received",
  received: "Received",
  recieved: "Received",
  new: "Received",
  "on progress": "On Progress",
  "in progress": "On Progress",
  processing: "On Progress",
  postponed: "Postponed",
  deferred: "Postponed",
  closed: "Closed",
  resolved: "Closed",
  reopened: "Reopened",
});

const serviceApplicationStatuses = freezeList([
  "Waiting for Payment",
  "Application Submitted",
  "Application On Progress",
  "Documents Received",
  "Documents Sent Courier",
]);

const serviceApplicationStatusAliases = Object.freeze({
  waiting: "Waiting for Payment",
  unpaid: "Waiting for Payment",
  "waiting for payment": "Waiting for Payment",
  submitted: "Application Submitted",
  "application submitted": "Application Submitted",
  processing: "Application On Progress",
  "in progress": "Application On Progress",
  "on progress": "Application On Progress",
  "application on progress": "Application On Progress",
  received: "Documents Received",
  "documents received": "Documents Received",
  sent: "Documents Sent Courier",
  couriered: "Documents Sent Courier",
  "documents sent courier": "Documents Sent Courier",
});

export const REPORT_DOMAINS = Object.freeze({
  tickets: Object.freeze({
    description:
      "Support-ticket counts, status distributions, and record-level ticket details.",
    keywords:
      /\b(ticket|tickets|help desk|support request|support requests|priority)\b/i,
    intents: Object.freeze({
      ticket_status:
        "Ticket counts grouped or filtered by canonical ticket status.",
      ticket_details:
        "Actual ticket records with title, description, status, priority, category, and createdAt.",
    }),
    groupings: freezeList(["none", "day", "week", "month", "status"]),
    collections: Object.freeze({
      Ticket: Object.freeze({
        fields: freezeList([
          "title:String",
          "description:String",
          `status:Enum(${ticketStatuses.join("|")})`,
          "priority:Enum(Low|Medium|High|Critical)",
          "category:Enum(Student|Finance|University|Application|Course Fee|Additional Documents|Other)",
          "createdAt:Date",
        ]),
      }),
    }),
    aliases: ticketStatusAliases,
    businessRules: freezeList([
      '"active", "open", and "new" mean status "Received".',
      '"ticket topic" means the ticket title and description.',
      'Use ticket_details for "tell me about", "show", "list", "which", existence, topic, and subject questions.',
      'Use ticket_status for "how many" and status-distribution questions.',
      "Never invent a status, priority, category, field, or filter.",
    ]),
  }),

  services: Object.freeze({
    description:
      "Documents & Services applications, their statuses, students, and partner-center ownership.",
    keywords:
      /\b(documents? (?:&|and) services|document services|service application|service applications)\b/i,
    intents: Object.freeze({
      service_application_status:
        "Unique students with Documents & Services applications grouped by latest status.",
    }),
    groupings: freezeList(["none", "day", "week", "month", "partner", "status"]),
    collections: Object.freeze({
      ServiceApplication: Object.freeze({
        fields: freezeList([
          "student:ObjectId->Student",
          "service:ObjectId->ServiceDefinition",
          `status:Enum(${serviceApplicationStatuses.join("|")})`,
          "paymentStatus:Enum(Unpaid|Partially Paid|Paid)",
          "createdAt:Date",
        ]),
      }),
      Student: Object.freeze({
        fields: freezeList([
          "registeredBy:ObjectId->AdmissionPoint",
          "deleted:Boolean",
        ]),
      }),
      AdmissionPoint: Object.freeze({
        fields: freezeList([
          "centerName:String",
          "location.city:String",
          "deleted:Boolean",
        ]),
      }),
    }),
    relationships: freezeList([
      "ServiceApplication.student -> Student._id",
      "Student.registeredBy -> AdmissionPoint._id",
    ]),
    aliases: serviceApplicationStatusAliases,
    businessRules: freezeList([
      "Count unique students using each student's latest service application.",
      "Resolve a requested partner against AdmissionPoint.centerName or location.city before querying.",
      "Do not use Student.applicationStatus for Documents & Services questions.",
    ]),
  }),

  universities: Object.freeze({
    description:
      "University Management: universities, programs, branches, activity status, types, and delivery modes.",
    keywords:
      /\b(university|universities|college|colleges|program|programs|branch|branches|specialization|specializations)\b/i,
    intents: Object.freeze({
      university_status:
        "University totals and active/inactive status, optionally by name or location.",
      university_programs:
        "Programs grouped by university, program type, mode, or status.",
      university_branches:
        "Branches or specializations grouped by university, program, type, or status.",
    }),
    groupings: freezeList([
      "none",
      "university",
      "program",
      "status",
      "program_type",
      "mode",
    ]),
    collections: Object.freeze({
      University: Object.freeze({
        fields: freezeList([
          "name:String",
          "shortName:String",
          "location:String",
          "isActive:Boolean",
          "createdAt:Date",
        ]),
      }),
      Program: Object.freeze({
        fields: freezeList([
          "name:String",
          "university:ObjectId->University",
          "isActive:Boolean",
          "programType:Enum(Bachelors Degree|Masters Degree|PG Diploma|Skill Programs|Skill Test)",
          "mode:Enum(External|On-Campus|Skill Based)",
          "createdAt:Date",
        ]),
      }),
      Branch: Object.freeze({
        fields: freezeList([
          "name:String",
          "program:ObjectId->Program",
          "duration:String",
          "type:Enum(CT|Vocational|Skilled)",
          "isActive:Boolean",
          "createdAt:Date",
        ]),
      }),
    }),
    relationships: freezeList([
      "Program.university -> University._id",
      "Branch.program -> Program._id",
    ]),
    businessRules: freezeList([
      "Resolve university names against University.name or shortName before filtering related records.",
      "Use isActive=true for active and isActive=false for inactive.",
      "Never invent university, program, branch, type, or mode values.",
    ]),
  }),

  payments: Object.freeze({
    description:
      "Course-fee completion by student and payment transaction summaries.",
    keywords:
      /\b(payment|payments|paid|unpaid|fee|fees|revenue|transaction|transactions)\b/i,
    intents: Object.freeze({
      student_payment_status:
        "Student course-fee completion using Student.paymentStatus.",
      payment_summary:
        "Payment totals, transaction counts, approval statuses, and amounts.",
    }),
    groupings: freezeList(["none", "day", "week", "month", "status"]),
    collections: Object.freeze({
      Student: Object.freeze({
        fields: freezeList([
          "paymentStatus:Enum(Paid|Partially Paid|Unpaid)",
          "totalFeePaid:Number",
          "deleted:Boolean",
          "createdAt:Date",
        ]),
      }),
      Payment: Object.freeze({
        fields: freezeList([
          "amount:Number",
          "approvalStatus:String",
          "type:Enum(Course Fee|Documents & Services|Onboarding Inspection Fee)",
          "createdAt:Date",
        ]),
      }),
    }),
    businessRules: freezeList([
      "Course-fee completion is Student.paymentStatus, not Payment.approvalStatus.",
      "Transaction summaries use Payment records.",
    ]),
  }),

  students: Object.freeze({
    description:
      "Student/application totals, application statuses, and registration trends.",
    keywords:
      /\b(student|students|application|applications|admission|admissions|registration|registrations|eligible|eligibility)\b/i,
    intents: Object.freeze({
      application_status:
        "Student/application totals grouped or filtered by applicationStatus.",
      admission_trend: "Student registrations grouped over time.",
    }),
    groupings: freezeList([
      "none",
      "day",
      "week",
      "month",
      "university",
      "program",
      "status",
    ]),
    collections: Object.freeze({
      Student: Object.freeze({
        fields: freezeList([
          "applicationStatus:String",
          "university:ObjectId->University",
          "program:ObjectId->Program",
          "registeredBy:ObjectId->AdmissionPoint",
          "createdAt:Date",
          "deleted:Boolean",
        ]),
      }),
    }),
    businessRules: freezeList([
      "Use admission_trend for registrations over time.",
      "Use application_status for application totals and pipeline status.",
    ]),
  }),

  partners: Object.freeze({
    description:
      "Admission-partner performance measured by registered student counts.",
    keywords:
      /\b(partner|partners|admission point|admission points|center|centers|centre|centres)\b/i,
    intents: Object.freeze({
      partner_performance:
        "Student registrations grouped by AdmissionPoint partner.",
    }),
    groupings: freezeList(["none", "partner"]),
    collections: Object.freeze({
      Student: Object.freeze({
        fields: freezeList([
          "registeredBy:ObjectId->AdmissionPoint",
          "createdAt:Date",
        ]),
      }),
      AdmissionPoint: Object.freeze({
        fields: freezeList([
          "centerName:String",
          "location.city:String",
          "status:String",
        ]),
      }),
    }),
    relationships: freezeList([
      "Student.registeredBy -> AdmissionPoint._id",
    ]),
    businessRules: freezeList([
      "Partner performance is the count of students registeredBy each AdmissionPoint.",
    ]),
  }),
});

export const REPORT_INTENTS = freezeList(
  Object.values(REPORT_DOMAINS).flatMap((domain) =>
    Object.keys(domain.intents),
  ),
);

export const REPORT_GROUPINGS = freezeList([
  ...new Set(
    Object.values(REPORT_DOMAINS).flatMap((domain) => domain.groupings),
  ),
]);

// Canonical enum access for deterministic query validation.
export const REPORT_CATALOG = Object.freeze({
  ticket_status: Object.freeze({
    statuses: ticketStatuses,
    aliases: ticketStatusAliases,
  }),
  service_application_status: Object.freeze({
    statuses: serviceApplicationStatuses,
    aliases: serviceApplicationStatusAliases,
  }),
  university_management: Object.freeze({
    universityStatuses: freezeList(["Active", "Inactive"]),
    programTypes: freezeList([
      "Bachelors Degree",
      "Masters Degree",
      "PG Diploma",
      "Skill Programs",
      "Skill Test",
    ]),
    programModes: freezeList([
      "External",
      "On-Campus",
      "Skill Based",
    ]),
    branchTypes: freezeList(["CT", "Vocational", "Skilled"]),
  }),
});

const normalizeTerm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const findCanonicalStatus = (statuses, aliases, value) => {
  const normalized = normalizeTerm(value);
  if (!normalized) return null;

  return (
    statuses.find((status) => normalizeTerm(status) === normalized) ||
    aliases[normalized] ||
    null
  );
};

const findStatusInQuestion = (aliases, question) => {
  const normalizedQuestion = ` ${normalizeTerm(question)} `;
  const matchedAlias = Object.keys(aliases)
    .sort((left, right) => right.length - left.length)
    .find((alias) => normalizedQuestion.includes(` ${alias} `));

  return matchedAlias ? aliases[matchedAlias] : null;
};

export const resolveTicketStatus = ({ question, aiStatus }) =>
  findStatusInQuestion(ticketStatusAliases, question) ||
  findCanonicalStatus(ticketStatuses, ticketStatusAliases, aiStatus);

export const resolveServiceApplicationStatus = (aiStatus) =>
  findCanonicalStatus(
    serviceApplicationStatuses,
    serviceApplicationStatusAliases,
    aiStatus,
  );

export const getDomainForIntent = (intent) =>
  Object.keys(REPORT_DOMAINS).find((domainId) =>
    Object.hasOwn(REPORT_DOMAINS[domainId].intents, intent),
  ) || null;

export const routeReportDomains = (question, previousPlan = null) => {
  const normalizedQuestion = normalizeTerm(question);
  const referencesPrevious =
    /\b(that|those|them|it|its|same|previous|above)\b/.test(
      normalizedQuestion,
    );
  if (referencesPrevious && previousPlan?.intent) {
    const previousDomain = getDomainForIntent(previousPlan.intent);
    if (previousDomain) return [previousDomain];
  }

  const matches = Object.entries(REPORT_DOMAINS)
    .filter(([, domain]) => domain.keywords.test(question))
    .map(([domainId]) => domainId);

  // Documents & Services includes payment terminology but belongs to the
  // services domain unless the user explicitly asks for its revenue.
  if (
    matches.includes("services") &&
    !/\b(revenue|amount|transaction|transactions|payment total)\b/i.test(
      question,
    )
  ) {
    return ["services"];
  }

  return [...new Set(matches)].slice(0, 2);
};

export const getAllowedIntents = (domainIds) =>
  domainIds.flatMap((domainId) =>
    Object.keys(REPORT_DOMAINS[domainId]?.intents || {}),
  );

export const getAllowedGroupings = (domainIds) => [
  ...new Set(
    domainIds.flatMap(
      (domainId) => REPORT_DOMAINS[domainId]?.groupings || [],
    ),
  ),
];

export const getDomainRouterPrompt = () =>
  Object.entries(REPORT_DOMAINS)
    .map(([domainId, domain]) => `- ${domainId}: ${domain.description}`)
    .join("\n");

const formatDomainContext = (domainId) => {
  const domain = REPORT_DOMAINS[domainId];
  if (!domain) return "";

  const intents = Object.entries(domain.intents)
    .map(([intent, description]) => `  - ${intent}: ${description}`)
    .join("\n");
  const collections = Object.entries(domain.collections)
    .map(
      ([collection, definition]) =>
        `  - ${collection}: ${definition.fields.join(", ")}`,
    )
    .join("\n");
  const relationships = domain.relationships?.length
    ? `\nRelationships:\n${domain.relationships.map((item) => `  - ${item}`).join("\n")}`
    : "";
  const aliases = domain.aliases
    ? `\nBusiness aliases:\n${Object.entries(domain.aliases)
        .map(([alias, value]) => `  - "${alias}" => "${value}"`)
        .join("\n")}`
    : "";

  return `Domain: ${domainId}
Description: ${domain.description}
Allowed intents:
${intents}
Allowed groupBy values: ${domain.groupings.join(", ")}
Approved schema:
${collections}${relationships}${aliases}
Business rules:
${domain.businessRules.map((rule) => `  - ${rule}`).join("\n")}`;
};

export const getReportCatalogPrompt = (domainIds) =>
  `${domainIds.map(formatDomainContext).join("\n\n")}

Return only canonical values from this context. Never invent collections, fields, joins, enums, filters, or intents.`;

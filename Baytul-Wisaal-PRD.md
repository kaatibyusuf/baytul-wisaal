# BAYTUL WISAAL

## Complete Product Requirements Document

**Product:** Baytul Wisaal
**Platform:** Responsive Web Application
**Primary Audience:** Muslims seriously seeking marriage
**Architecture:** Next.js frontend + NestJS backend
**Status:** Product Specification / MVP

---

## Contents

**Part I: Product**
1. Product Vision
2. Core Product Philosophy
3. Target Users
4. Core User Journey
5. Registration
6. Profile System

**Part II: Marriage Readiness and Assessment**
7. One-Month Marriage Readiness Programme
8. Scenario-Based Assessment
9. Assessment Rubrics
10. AI-Assisted Assessment
11. AI Must Not Be the Final Authority
12. Critical Failure Conditions
13. Consistency Engine
14. Adaptive Assessments
15. Completion Requirements

**Part III: Preferences and Matchmaking**
16. Spouse Preference Form
17. Hard Requirements vs Preferences
18. Filtering
19. Matchmaking Engine
20. Match Creation
21. Post-Match Expectation Form
22. Match Response
23. Compatibility Assessment
24. Match Failure
25. Match History
26. Communication

**Part IV: Assessment Integrity**
27. Assessment Integrity and Anti-Cheating
28. AI-Generated Answer Detection
29. High-Risk Verification
30. Question Security

**Part V: Platform Experience and Operations**
31. User Dashboard
32. Notifications
33. Admin Dashboard
34. Privacy
35. Security
36. Audit Logs

**Part VI: Technical Architecture**
37. Technical Architecture Overview
38. Frontend
39. Backend
40. API
41. Database
42. Authentication
43. AI Architecture
44. Background Jobs
45. File Storage
46. Admin Application
47. Shared Types
48. Repository Structure
49. Caching and Sessions
50. Email
51. Payments
52. Analytics
53. Error Monitoring
54. Testing
55. Deployment
56. Final Technology Stack

**Part VII: Brand and Design**
57. Brand Identity
58. Brand Colour System
59. Brand Colour Hierarchy
60. Colour Usage Principles
61. Accessibility
62. Typography
63. Logo and Brand Mark
64. Iconography
65. Imagery
66. Design Language and UI Components
67. Motion and Animation
68. Landing Page
69. Mobile-First Experience

**Part VIII: Scope and Principles**
70. MVP Scope
71. Non-Negotiable Product Rules
72. Product North Star
73. Brand Quick Reference

---

# PART I: PRODUCT

# 1. PRODUCT VISION

Baytul Wisaal is a structured marriage-readiness and matchmaking platform for Muslims who are seriously seeking marriage.

The product is built around one fundamental idea:

> **Marriage is a big deal, and we are going to treat it as such.**

Baytul Wisaal should not feel like a conventional dating application.

It should not encourage endless browsing, swiping, superficial attraction, or collecting matches.

Instead, the platform should encourage users to:

**Prepare → Reflect → Define → Match → Respond → Proceed**

The product should help users think beyond:

* Physique
* Photographs
* Initial attraction
* Chemistry
* Social status
* Superficial preferences

Users should be encouraged to think about:

* Religion
* Character
* Responsibility
* Finances
* Children
* Parenting
* Family
* Communication
* Conflict
* Household responsibilities
* Expectations
* Sacrifice
* Long-term compatibility

The objective is not to determine who is a "good" or "bad" person.

The objective is to determine whether two people have sufficiently compatible expectations and approaches to building a marriage.

---

# 2. CORE PRODUCT PHILOSOPHY

## 2.1 Marriage before matchmaking

Users should not immediately gain access to potential spouses.

They must first complete a structured marriage-readiness programme.

The premise is:

> Before looking for someone to marry, spend time thinking seriously about marriage.

## 2.2 Demonstrated behaviour over self-description

The platform should not rely entirely on questions such as:

> "Are you good at communication?"

Instead, users should be placed into realistic situations.

For example:

> Your spouse loses their job. Your parent urgently needs money. Your savings are limited. Your spouse disagrees with you using the emergency fund. What do you do?

The user must actually make a decision and explain it.

## 2.3 Compatibility over perfection

Baytul Wisaal should not attempt to find a universally perfect spouse.

Two people can both be responsible, religious, mature individuals and still be fundamentally incompatible.

Therefore, the system evaluates **pair compatibility**, not human worth.

## 2.4 Seriousness should have consequences

The platform should have meaningful gates.

Completing one stage unlocks another.

Failing certain requirements prevents progression.

If two users are determined to be incompatible at a particular stage, the pairing should not be presented again.

---

# 3. TARGET USERS

Baytul Wisaal is designed for:

* Muslim singles seriously considering marriage.
* People who want a structured marriage-search process.
* People willing to undergo preparation and assessment.
* People who want to clarify their expectations before meeting a potential spouse.
* People who value long-term compatibility over casual interaction.

The product is not intended for:

* Casual dating.
* Entertainment.
* Endless profile browsing.
* Swipe-based matchmaking.
* Collecting matches.
* Public popularity contests.

---

# 4. CORE USER JOURNEY

The initial product flow should be:

```text
Landing Page
      ↓
Registration
      ↓
Profile
      ↓
Marriage Readiness Programme
      ↓
Assessment & Evaluation
      ↓
Programme Completion
      ↓
Spouse Preferences
      ↓
Matchmaking
      ↓
Match Created
      ↓
Expectation Form
      ↓
Candidate Responds
      ↓
Compatibility Assessment
      ↓
Pass / Pairing Closed
      ↓
Next Marriage Procedure
```

The later procedures after a successful match will be defined separately.

The architecture must therefore support additional stages without requiring the application to be rebuilt.

---

# 5. REGISTRATION

Users create an account.

Initial information should include:

* Full name
* Preferred name
* Gender
* Date of birth
* Location
* Nationality
* Marital status
* Email
* Phone number
* Profile photograph
* Education
* Occupation
* Relevant religious information
* Basic family information

Additional information should be collected progressively.

Do not overwhelm users with a huge registration form.

Registration does not immediately grant access to other users.

---

# 6. PROFILE SYSTEM

Profiles should have different levels of visibility.

## Private information

Visible only to the platform/admin where necessary.

## Match information

Information that can be shared with a potential match at the appropriate stage.

## Basic profile information

Information intentionally made available within the matchmaking process.

Users must not be able to browse the entire user database.

---

# PART II: MARRIAGE READINESS AND ASSESSMENT

# 7. ONE-MONTH MARRIAGE READINESS PROGRAMME

This is one of the central features of Baytul Wisaal.

Before becoming eligible for matchmaking, users must complete a structured **30-day marriage-readiness programme**.

The exact curriculum will be supplied separately.

The system must support:

* Daily lessons
* Written reflections
* Scenario-based assessments
* Quizzes
* Practical assignments
* Progress tracking
* Pass/fail requirements
* Retakes where permitted
* Administrative review
* Time-based progression

Example:

```text
Day 17 of 30

Marriage & Financial Responsibility

✓ Lesson completed
✓ Reflection submitted
✓ Scenario completed
○ Follow-up assessment
```

Users cannot simply mark activities as completed.

The backend must verify completion.

---

# 8. SCENARIO-BASED ASSESSMENT

The platform must contain realistic marriage scenarios.

Questions should force users to make decisions where every option has consequences.

Example:

> You have been married for 14 months.
>
> Your combined household income is ₦650,000.
>
> Your spouse loses their job.
>
> Your father urgently needs ₦250,000 for medical treatment.
>
> You have ₦900,000 in savings.
>
> Your spouse does not want you to use the emergency fund without discussing it together.
>
> Your father says your wife has become more important to you than your own father.
>
> You have 48 hours to decide.
>
> What do you do?

The user should then be required to:

1. Make a decision.
2. Explain the decision.
3. Explain where the money comes from.
4. Explain what they tell their spouse.
5. Explain what they tell their parent.
6. Explain what expenses they would cut.
7. Explain what happens if their spouse disagrees.
8. Explain what happens if their parent becomes angry.
9. Identify what each side is right about.
10. State the principle behind their decision.

The user should not be allowed to answer with vague phrases such as:

* "I would communicate."
* "I would pray about it."
* "I would seek advice."
* "It depends."
* "Both sides are important."

They must make an actual decision.

---

# 9. ASSESSMENT RUBRICS

Every scenario must have a predefined rubric.

Example:

| Competency               | Weight |
| ------------------------ | -----: |
| Financial responsibility |    20% |
| Communication            |    20% |
| Conflict resolution      |    20% |
| Consideration of spouse  |    15% |
| Practical reasoning      |    15% |
| Self-awareness           |    10% |

Rubrics must be configurable from the admin dashboard.

The user should not see the exact grading rubric.

---

# 10. AI-ASSISTED ASSESSMENT

AI will evaluate free-text responses against predefined rubrics.

The AI should not simply determine whether an answer "sounds good."

It should identify evidence demonstrating each competency.

Example internal result:

```json
{
  "financial_responsibility": 17,
  "communication": 18,
  "conflict_resolution": 14,
  "consideration": 15,
  "practical_reasoning": 13,
  "self_awareness": 8,
  "total": 85
}
```

The AI should also return:

* Evidence supporting scores.
* Potential concerns.
* Contradictions.
* Confidence level.
* Recommended follow-up questions.

The original user answer must always be preserved.

---

# 11. AI MUST NOT BE THE FINAL AUTHORITY

AI is an assessment assistant, not the final decision-maker.

The system should work as:

```text
User Answer
     ↓
AI Evaluation
     ↓
Business Rules
     ↓
Human Review where required
     ↓
Final Decision
```

The AI must never directly execute irreversible actions such as:

* Permanently banning a user.
* Permanently excluding a user.
* Deleting an account.
* Making an irreversible matchmaking decision.

All consequential actions must be auditable.

---

# 12. CRITICAL FAILURE CONDITIONS

Some scenarios may contain critical criteria.

Examples could include:

* Explicit willingness to use violence.
* Coercive behaviour.
* Serious deliberate deception.
* Severe financial irresponsibility.
* Other administrator-defined critical concerns.

A critical flag should trigger human review regardless of the overall score.

A user should not automatically be permanently banned based solely on an AI interpretation.

---

# 13. CONSISTENCY ENGINE

The platform should compare responses across the entire programme.

Example:

Earlier:

> "Major financial decisions should be discussed jointly."

Later:

> "If my wife disagrees with my financial decision, I would simply make the decision because I am the husband."

The system should flag the contradiction.

The user may receive a follow-up:

> "Earlier, you stated that major financial decisions should be discussed jointly. What has changed in this situation?"

This allows Baytul Wisaal to assess consistency under changing circumstances.

---

# 14. ADAPTIVE ASSESSMENTS

Assessment questions should not always be identical.

The platform should support:

* Scenario variants.
* Randomized numerical values.
* Randomized contextual details.
* Different versions testing the same competency.
* Adaptive follow-up questions.

Example:

User:

> "I would communicate with my spouse and find a compromise."

Follow-up:

> "What specifically would you be willing to compromise on?"

Then:

> "Your spouse rejects your proposed compromise. What do you do next?"

The objective is to test reasoning rather than memorization.

---

# 15. COMPLETION REQUIREMENTS

Users become eligible for matchmaking only after satisfying the configured requirements.

Possible requirements:

* Minimum programme completion.
* Required lessons completed.
* Required assessments completed.
* Minimum assessment performance.
* Required reflections submitted.
* Critical assessments passed.
* Required verification completed.
* Programme completed within the allowed timeframe.

All thresholds must be configurable.

Do not hard-code them.

---

# PART III: PREFERENCES AND MATCHMAKING

# 16. SPOUSE PREFERENCE FORM

After completing the one-month programme, the user is automatically asked to define what they seek in a spouse.

The philosophy is:

> The month should have made you think better about what you actually want from marriage.

The form should cover:

## Religion

* Religious practice.
* Islamic education.
* Qur'an.
* Religious environment.
* Expectations for religious growth.

## Marriage

* Expectations of husband/wife.
* Decision-making.
* Household responsibilities.
* Privacy.
* Conflict resolution.
* Communication.

## Children

* Whether they want children.
* Number of children.
* Parenting.
* Childcare.
* Islamic education.

## Finance

* Financial expectations.
* Employment.
* Household contributions.
* Saving.
* Spending.
* Debt.

## Family

* Living arrangements.
* In-laws.
* Extended-family involvement.
* Geographic location.

## Lifestyle

* Career.
* Education.
* Travel.
* Social life.
* Housing.

## Personal preferences

Physical preferences may be included.

However, the UX should deliberately prevent physical preferences from dominating the process.

The central philosophy is:

> **Think beyond physique.**

---

# 17. HARD REQUIREMENTS VS PREFERENCES

Users must distinguish between:

### Non-negotiable

A requirement that must be satisfied.

### Preference

Something the user would like but can compromise on.

### Flexible

Something open to discussion.

This distinction is critical for matchmaking.

---

# 18. FILTERING

Users should be able to define filters such as:

* Age range.
* Location.
* Marital status.
* Education.
* Profession.
* Religious preferences.
* Children.
* Relocation.
* Marriage timeline.
* Other administrator-defined criteria.

The matchmaking system must distinguish between hard filters and soft preferences.

---

# 19. MATCHMAKING ENGINE

Baytul Wisaal should not operate like Tinder.

Users should not endlessly swipe through profiles.

The matchmaking engine should identify eligible candidates based on:

1. Programme eligibility.
2. Hard filters.
3. Preferences.
4. Marriage expectations.
5. Compatibility.
6. Previous match history.
7. Existing exclusions.
8. Administrative rules.
9. Current availability.

The initial matchmaking engine should be rules-based rather than machine-learning based.

Machine learning can be introduced later after sufficient real-world data exists.

---

# 20. MATCH CREATION

When the system creates a match, both users are notified.

The match should not immediately become an unrestricted chat relationship.

Instead, both users automatically move into the next structured stage.

---

# 21. POST-MATCH EXPECTATION FORM

Once matched, each person must complete a detailed form:

> **What exactly are you seeking in a spouse?**

The user should be encouraged to think carefully before submitting.

The form can include:

* Non-negotiables.
* Preferences.
* Religious expectations.
* Family expectations.
* Financial expectations.
* Parenting expectations.
* Career expectations.
* Household expectations.
* Personality preferences.
* Lifestyle expectations.
* Physical preferences.
* Deal-breakers.
* Areas where they are willing to compromise.

---

# 22. MATCH RESPONSE

Once User A submits their expectations, User B receives the form.

User B must respond to each relevant expectation.

Use structured responses wherever possible:

* Agree.
* Disagree.
* Partially agree.
* Willing to discuss.
* Not applicable.

Written explanation should be required where appropriate.

Example:

> "I want to live separately from both families."

Response:

> Agree / Disagree / Discuss

Then:

> Explain your position.

This prevents a meaningless "yes" from being interpreted as genuine agreement.

---

# 23. COMPATIBILITY ASSESSMENT

The system compares:

**What User A seeks**

against

**What User B can accept/provide.**

And vice versa.

The system should classify areas as:

### Aligned

Both parties substantially agree.

### Needs discussion

There is a difference that may be resolvable.

### Conflict

There is a significant disagreement.

The system should not determine that one person is "better."

It determines whether the **pairing** meets the configured requirements.

---

# 24. MATCH FAILURE

If the pairing fails the required compatibility stage:

* The pairing is closed.
* Both users are notified.
* The users are permanently prevented from being matched with each other again.
* Both remain eligible for other suitable matches.

The product should not communicate:

> "You failed."

Instead:

> **"This pairing did not meet the requirements for the next stage."**

The distinction is important.

A failed pairing does not necessarily mean either person is unsuitable for marriage.

---

# 25. MATCH HISTORY

Users should have private match history.

They can see:

* Current match.
* Previous matches.
* Stage reached.
* Status.
* Date.
* Appropriate closure information.

Users should not automatically gain access to private answers or sensitive information submitted by previous matches.

---

# 26. COMMUNICATION

Do not launch with unrestricted messaging.

The communication architecture should be stage-based.

Potential future flow:

```text
Match
 ↓
Structured Questions
 ↓
Limited Communication
 ↓
Family Involvement
 ↓
Further Procedure
```

Messaging permissions should depend on the user's current stage.

---

# PART IV: ASSESSMENT INTEGRITY

# 27. ASSESSMENT INTEGRITY & ANTI-CHEATING

The assessment must be designed to discourage users from copying questions into ChatGPT, Claude, Gemini, or other LLMs.

The objective is not simply to stop cheating.

The objective is to determine how the user actually thinks.

## 27.1 Disable Copying

On protected assessment questions:

* Disable text selection.
* Disable common copy shortcuts.
* Disable right-click/context menu.
* Disable drag-and-drop extraction.
* Do not provide copy buttons.
* Do not provide printable question versions.
* Do not provide downloadable question sheets.

The answer field must remain fully editable.

## 27.2 Prevent Easy LLM Transfer

Do not provide mechanisms that make it easy to export questions.

Questions should be retrieved dynamically when required.

Do not expose the entire question bank to the frontend.

Do not expose assessment questions through publicly accessible endpoints.

## 27.3 Detect Suspicious Behaviour

Track assessment events such as:

* Tab switching.
* Window losing focus.
* Repeatedly leaving the assessment.
* Unusual paste activity.
* Extremely rapid submission.
* Long inactivity periods.
* Multiple simultaneous sessions.
* Repeated page reloads.
* Session changes.

These should contribute to an integrity flag.

They should not automatically mean the user cheated.

## 27.4 Paste Protection

Where appropriate, detect:

* Large pasted blocks.
* Sudden insertion of unusually long text.
* Suspiciously rapid answer completion.

Do not automatically reject every paste.

Accessibility tools and legitimate input methods can generate false positives.

## 27.5 Screenshot Deterrence

Implement reasonable technical measures to discourage screenshots.

Where supported:

* Detect browser/device screen-capture events.
* Hide sensitive assessment content when appropriate.
* Use dynamic rendering.
* Add session-specific watermarks.

Example:

> Baytul Wisaal • Assessment Session • BW-82F91

This makes unauthorized screenshots traceable to an assessment session.

### Technical limitation

A web application cannot guarantee that screenshots are impossible.

A user can photograph the screen using another device or use operating-system-level capture tools outside browser control.

Therefore the strategy is:

**Deterrence + detection + randomization + adaptive assessment + auditability.**

---

# 28. AI-GENERATED ANSWER DETECTION

Do not rely on an AI detector as the sole mechanism for determining whether a response was AI-generated.

AI detection tools are not sufficiently reliable for that purpose.

Instead, use multiple signals:

* Copy/paste behaviour.
* Sudden writing-style changes.
* Generic answers.
* Failure to address specific details.
* Contradictions.
* Inability to answer follow-ups.
* Suspicious session behaviour.
* Inconsistent reasoning across assessments.

Suspicious cases should be routed to review.

---

# 29. HIGH-RISK VERIFICATION

For particularly important assessments, the system should support additional verification.

An administrator may ask the user to provide a short live or recorded explanation.

Example:

> "You wrote that you would handle the situation this way. Explain your reasoning in your own words."

The objective is verification, not punishment.

---

# 30. QUESTION SECURITY

Assessment questions are protected platform content.

The backend should:

* Store questions securely.
* Serve only questions required for the current session.
* Use authenticated assessment sessions.
* Expire assessment-session access.
* Prevent unauthorized API access.
* Log question access.
* Maintain question versions.
* Maintain rubric versions.

---

# PART V: PLATFORM EXPERIENCE AND OPERATIONS

# 31. USER DASHBOARD

The dashboard should clearly show the user's current stage.

Example:

```text
YOUR BAYTUL WISAAL JOURNEY

✓ Account
✓ Profile
✓ Week 1
✓ Week 2
✓ Week 3
→ Week 4
○ Marriage Preferences
○ Matchmaking
○ Compatibility
○ Next Stage
```

Always answer three questions:

**Where am I?**

**What do I need to do?**

**What happens next?**

---

# 32. NOTIFICATIONS

Support notifications for:

* Programme activities.
* Assessment deadlines.
* Assessment results.
* Match creation.
* Expectation forms.
* Response requirements.
* Match progression.
* Match closure.
* Administrative requests.
* New stages.

Use in-app notifications and transactional email.

---

# 33. ADMIN DASHBOARD

Administrators should be able to manage:

## Users

* Search.
* View.
* Verify.
* Suspend.
* Restrict.
* Restore.
* View progression.

## Programme

* Create lessons.
* Edit lessons.
* Create scenarios.
* Edit scenarios.
* Define rubrics.
* Define thresholds.
* Define critical criteria.
* Create follow-up questions.

## Assessments

* View responses.
* View AI evaluations.
* Review flags.
* Override AI recommendations.
* Approve.
* Fail.
* Request clarification.
* Send additional assessment.

## Matchmaking

* View matches.
* Manually intervene.
* Prevent specific pairings.
* View compatibility.
* Manage match stages.

---

# 34. PRIVACY

Baytul Wisaal will handle sensitive personal and marriage-related information.

Privacy must be designed into the architecture.

Separate:

```text
Public Profile
      ↓
Match Profile
      ↓
Private Preferences
      ↓
Private Assessments
      ↓
Verification/Admin Data
```

A user's private assessment responses must not automatically become visible to a match.

Only information required for the current stage should be disclosed.

---

# 35. SECURITY

Implement:

* HTTPS.
* Secure headers.
* CSRF protection where applicable.
* XSS protection.
* SQL injection protection.
* Rate limiting.
* Input validation.
* Secure password hashing.
* Secure cookies.
* Role-based authorization.
* API authentication.
* Signed upload URLs.
* Audit logging.
* Session expiry.
* Login abuse protection.

Never trust client-side validation.

Important rules must always be enforced server-side.

---

# 36. AUDIT LOGS

Every sensitive administrative action must be recorded.

Example:

```text
Admin: user_123
Action: MATCH_EXCLUDED
Target: user_456
Reason: Manual moderation
Timestamp: 2026-10-03 19:42
```

Audit logs should be append-only from the application's perspective.

Administrators should not be able to silently alter historical records.

---

# PART VI: TECHNICAL ARCHITECTURE

# 37. TECHNICAL ARCHITECTURE OVERVIEW

Baytul Wisaal will use a separate frontend and backend architecture.

### Frontend

**Next.js + TypeScript**

### Backend

**NestJS + TypeScript**

### Database

**PostgreSQL + Prisma**

This is a firm architectural decision.

**Next.js is the frontend. NestJS is the backend.**

Next.js server actions/API routes must not become the primary backend.

---

# 38. FRONTEND

Use:

**Next.js**

with:

* React.
* TypeScript.
* App Router.
* Tailwind CSS.
* shadcn/ui.
* React Hook Form.
* Zod.

Responsibilities:

* User interface.
* Routing.
* Public pages.
* Authentication UI.
* Dashboard.
* Assessments.
* Profiles.
* Match interface.
* Admin interface.
* API communication.

The frontend must not contain core business logic.

---

# 39. BACKEND

Use:

**NestJS**

as the authoritative application backend.

Core modules:

```text
AuthModule
UserModule
ProfileModule
ProgrammeModule
AssessmentModule
AssessmentIntegrityModule
AIModule
PreferenceModule
MatchmakingModule
CompatibilityModule
NotificationModule
AdminModule
ModerationModule
AuditModule
FileModule
PaymentModule
```

NestJS handles:

* Authentication.
* Authorization.
* Users.
* Profiles.
* Programme progression.
* Assessments.
* AI evaluation.
* Matchmaking.
* Compatibility.
* Match exclusions.
* Notifications.
* Files.
* Administration.
* Audit logs.
* Business rules.

---

# 40. API

The frontend communicates with NestJS through a versioned REST API.

Base:

```text
/api/v1
```

Example endpoints:

```text
POST /api/v1/auth/login

GET /api/v1/users/me

GET /api/v1/programme/progress

GET /api/v1/assessments/current

POST /api/v1/assessments/:id/answer

GET /api/v1/matches

GET /api/v1/matches/:id

POST /api/v1/matches/:id/preferences

POST /api/v1/matches/:id/respond
```

Document the API using OpenAPI/Swagger.

---

# 41. DATABASE

Use:

**PostgreSQL**

with:

**Prisma ORM**

Only NestJS should directly access PostgreSQL.

Architecture:

```text
Next.js
   ↓
NestJS
   ↓
Prisma
   ↓
PostgreSQL
```

The frontend must never connect directly to the database.

---

# 42. AUTHENTICATION

Use:

**NestJS + Passport**

with secure HTTP-only cookies or secure token-based authentication.

Never store sensitive authentication credentials in localStorage.

Roles:

```text
USER
MODERATOR
ADMIN
SUPER_ADMIN
```

Use role-based and permission-based authorization.

---

# 43. AI ARCHITECTURE

AI must be provider-independent.

Create an internal abstraction:

```text
AssessmentEvaluator

evaluateAnswer()
identifyEvidence()
detectContradictions()
generateFollowUp()
summarizeCompatibility()
```

This allows the AI provider to change later.

The backend sends the AI:

* Scenario.
* Rubric.
* User response.
* Relevant previous responses.
* Evaluation instructions.

The AI returns:

* Criterion scores.
* Evidence.
* Concerns.
* Confidence.
* Follow-up recommendation.
* Overall recommendation.

The browser must never communicate directly with the AI provider.

API keys must never be exposed to the frontend.

---

# 44. BACKGROUND JOBS

Use:

**BullMQ + Redis**

for:

* AI evaluation.
* Follow-up generation.
* Matchmaking calculations.
* Compatibility processing.
* Emails.
* Scheduled reminders.
* Integrity analysis.

Flow:

```text
NestJS
 ↓
BullMQ
 ↓
Redis
 ↓
Worker
 ↓
Process
 ↓
PostgreSQL
```

Long-running AI operations should not block HTTP requests.

---

# 45. FILE STORAGE

Use:

**Cloudflare R2**

for:

* Profile photographs.
* Verification documents.
* Optional assessment recordings.
* Other uploads.

Use signed URLs.

Sensitive files must not be publicly accessible.

---

# 46. ADMIN APPLICATION

The admin dashboard should also be built using Next.js.

It communicates with the same NestJS API.

```text
User Web App ───┐
                ├──→ NestJS API
Admin Web App ──┘
                     ↓
                 PostgreSQL
```

Admin authorization must determine what each administrator can access.

---

# 47. SHARED TYPES

Where practical, use shared TypeScript contracts.

Use OpenAPI-generated clients or shared schemas.

The backend remains authoritative.

---

# 48. REPOSITORY STRUCTURE

Use a monorepo with:

**pnpm + Turborepo**

Recommended structure:

```text
baytul-wisaal/

├── apps/
│   ├── web/
│   │   └── Next.js
│   │
│   ├── api/
│   │   └── NestJS
│   │
│   └── worker/
│       └── NestJS workers
│
├── packages/
│   ├── types/
│   ├── api-client/
│   ├── validation/
│   └── config/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
└── package.json
```

---

# 49. CACHING & SESSIONS

Use:

**Redis**

for:

* Temporary assessment state.
* Rate limiting.
* Session-related state.
* Matchmaking queues.
* Notification queues.
* Frequently accessed content.
* Abuse controls.

PostgreSQL remains the source of truth.

---

# 50. EMAIL

Use:

**Resend**

for:

* Verification.
* Password reset.
* Programme reminders.
* Assessment notifications.
* Match notifications.
* Administrative communication.

Email templates must follow the brand system in Part VII.

---

# 51. PAYMENTS

If paid features are introduced:

Use:

**Paystack**

for Nigerian payments.

Do not store card information directly.

Payment processing must be separate from matchmaking logic.

---

# 52. ANALYTICS

Use:

**PostHog**

for product analytics.

Track:

* Registration.
* Programme start.
* Programme completion.
* Assessment start.
* Assessment completion.
* Match creation.
* Match progression.
* Match closure.

Never send private assessment answers or sensitive marriage information into analytics.

---

# 53. ERROR MONITORING

Use:

**Sentry**

for:

* Frontend errors.
* Backend errors.
* Worker failures.
* API errors.
* Performance issues.

Sensitive user information must be scrubbed from error reports.

---

# 54. TESTING

Use:

**Playwright** for end-to-end testing.

Use unit and integration tests for:

* Eligibility.
* Assessment scoring.
* Matchmaking.
* Compatibility.
* Match exclusions.
* Permissions.
* Authentication.

Critical journey:

```text
Registration
→ Programme
→ Assessment
→ Completion
→ Preferences
→ Match
→ Expectation Form
→ Response
→ Compatibility
→ Next Stage
```

The matching and exclusion logic must have particularly strong automated coverage.

---

# 55. DEPLOYMENT

Recommended initial infrastructure:

| Component        | Technology           |
| ---------------- | -------------------- |
| Frontend         | Vercel               |
| Backend          | Containerized NestJS |
| Database         | PostgreSQL           |
| Database hosting | Neon or Supabase     |
| Redis            | Upstash              |
| Storage          | Cloudflare R2        |
| Email            | Resend               |
| Payments         | Paystack             |
| Analytics        | PostHog              |
| Error monitoring | Sentry               |
| Source control   | GitHub               |
| Monorepo         | pnpm + Turborepo     |

The infrastructure should remain portable enough to migrate to dedicated servers/cloud infrastructure as the platform grows.

---

# 56. FINAL TECHNOLOGY STACK

| Layer               | Technology                           |
| ------------------- | ------------------------------------ |
| Frontend            | Next.js                              |
| Frontend Language   | TypeScript                           |
| UI                  | React + Tailwind CSS + shadcn/ui     |
| Forms               | React Hook Form + Zod                |
| Backend             | NestJS                               |
| Backend Language    | TypeScript                           |
| API                 | REST + OpenAPI                       |
| Database            | PostgreSQL                           |
| ORM                 | Prisma                               |
| Authentication      | NestJS Passport                      |
| Cache               | Redis                                |
| Background Jobs     | BullMQ                               |
| File Storage        | Cloudflare R2                        |
| AI                  | Provider-independent LLM abstraction |
| Email               | Resend                               |
| Payments            | Paystack                             |
| Analytics           | PostHog                              |
| Error Monitoring    | Sentry                               |
| E2E Testing         | Playwright                           |
| Monorepo            | pnpm + Turborepo                     |
| Source Control      | GitHub                               |
| Frontend Deployment | Vercel                               |
| Backend Deployment  | Containerized NestJS                 |

---

# PART VII: BRAND AND DESIGN

# 57. BRAND IDENTITY

Baytul Wisaal's visual identity should communicate the same qualities as its product philosophy:

**Serious. Calm. Trustworthy. Warm. Refined. Private. Mature. Islamic. Modern.**

The design must feel premium without becoming luxurious or ostentatious.

It should feel welcoming without becoming playful.

It should feel distinctly Muslim without relying on excessive decorative Islamic motifs.

The visual language should communicate **trust, intentionality, depth and permanence**.

---

# 58. BRAND COLOUR SYSTEM

These are the canonical Baytul Wisaal brand colours.

They must be used consistently across the product, website, marketing materials, illustrations, email templates and future brand assets.

| Name          | HEX       | Role                        |
| ------------- | --------- | --------------------------- |
| **NileBlue**  | `#17334B` | Primary dark brand colour   |
| **DeepAqua**  | `#19687E` | Secondary brand colour      |
| **Turquoise** | `#02D3CB` | Accent / interaction colour |
| **SoftGold**  | `#D9A441` | Premium/warm accent         |

## 58.1 NileBlue: `#17334B`

**Role:** Primary brand colour.

Use for:

* Primary headings.
* Navigation.
* Major buttons where appropriate.
* Footer.
* Dark sections.
* Important text.
* Brand marks.
* Strong UI elements.

NileBlue should establish the seriousness and maturity of the brand.

It should be the visual anchor of the interface.

## 58.2 DeepAqua: `#19687E`

**Role:** Secondary brand colour.

Use for:

* Secondary buttons.
* Links.
* Supporting headings.
* Cards.
* Selected states.
* Section accents.
* Information components.
* Secondary navigation elements.

DeepAqua provides colour without making the interface feel overly bright.

## 58.3 Turquoise: `#02D3CB`

**Role:** Bright interactive accent.

Use selectively for:

* Progress indicators.
* Active states.
* Focus states.
* Success/positive interaction cues.
* Small decorative elements.
* Important interface highlights.
* Interactive controls.

Turquoise should **not** dominate the interface.

Its purpose is to provide moments of energy against the deeper brand palette.

## 58.4 SoftGold: `#D9A441`

**Role:** Warm premium accent.

Use for:

* Important milestones.
* Special programme markers.
* Premium moments.
* Subtle decorative details.
* Selected highlights.
* Achievement states.
* Important but non-alarming emphasis.

SoftGold should be used sparingly.

It should feel like an accent of warmth and value, not a generic luxury colour.

---

# 59. BRAND COLOUR HIERARCHY

The colours should not be treated as four equal colours.

Recommended hierarchy:

```text
NileBlue
   ↓
DeepAqua
   ↓
Turquoise
   ↓
SoftGold
```

NileBlue carries the brand.

DeepAqua supports it.

Turquoise creates interaction and energy.

SoftGold adds warmth and distinction.

The interface should primarily feel **NileBlue + DeepAqua**, with Turquoise and SoftGold used intentionally.

---

# 60. COLOUR USAGE PRINCIPLES

Avoid turning every component into a branded colour block.

Large areas should generally use:

* White.
* Very light neutral backgrounds.
* Subtle tints derived from the brand palette.

Brand colours should provide structure and emphasis.

For example:

### Primary CTA

NileBlue background with white text.

### Secondary CTA

DeepAqua background with white text.

### Interactive accent

Turquoise for progress, active indicators or focused states.

### Milestone

SoftGold used as a subtle highlight.

### Dark section

NileBlue background with white typography and restrained Turquoise/SoftGold accents.

---

# 61. ACCESSIBILITY

All colour combinations must be tested for sufficient contrast.

Do not use Turquoise or SoftGold as light text on white backgrounds merely because they are brand colours.

When contrast is insufficient, use:

* NileBlue.
* DeepAqua.
* White.
* Appropriate accessible neutral variants.

Brand consistency must never override accessibility.

### Measured contrast reference (WCAG)

| Pairing                              | Ratio  | Use as text? |
| ------------------------------------ | -----: | ------------ |
| White on NileBlue                    | 13.0:1 | Yes          |
| White on DeepAqua                    |  6.3:1 | Yes          |
| White on Turquoise                   |  1.9:1 | No           |
| White on SoftGold                    |  2.3:1 | No           |
| NileBlue on Turquoise                |  6.9:1 | Yes          |
| NileBlue on SoftGold                 |  5.8:1 | Yes          |
| Turquoise or SoftGold on NileBlue    | 6.9:1 / 5.8:1 | Yes   |

For Turquoise and SoftGold content on light backgrounds, use the accessible darker variants defined in the theme file: `aqua-ink` (`#0E7F86`) and `gold-ink` (`#8A5F0F`).

---

# 62. TYPOGRAPHY

The typography should communicate:

**Editorial seriousness + modern digital clarity.**

The product should avoid fonts that feel excessively playful, futuristic or corporate.

Typography hierarchy should be clear:

```text
Display
↓
H1
↓
H2
↓
H3
↓
Body
↓
Supporting text
↓
Metadata
```

Large headings should have enough breathing room to create a calm, editorial feeling.

Body text must prioritize readability, especially because the application contains:

* Long lessons.
* Reflections.
* Assessment scenarios.
* Written answers.
* Match expectations.

### Font direction

* **Primary UI font:** a clean, contemporary sans-serif. The typeface is still to be selected. The logo wordmark uses a geometric sans, and the UI font should sit comfortably alongside it.
* **Supporting font:** a complementary serif may be introduced selectively for editorial or philosophical statements. The serif must not be used for functional UI.

The aim is a visual distinction between the **product interface** and **reflective/editorial content**.

Typography must remain highly legible on mobile.

---

# 63. LOGO & BRAND MARK

The Baytul Wisaal logo should be simple, recognizable and restrained.

Avoid overly complicated mosque, minaret, heart, wedding-ring or couple imagery.

The identity should communicate **connection, home, union and intentionality** rather than romance alone.

### Current logo

The current logo is a symbol and wordmark lockup. The symbol is a turquoise calligraphic form held between two white curved shapes, with a small diamond at the base. The wordmark "Baytul Wisaal" is set in white, in two lines, in a geometric sans-serif. The supplied version is for dark backgrounds, on NileBlue.

### Required logo variants

The logo must work in:

* Full colour.
* NileBlue.
* White.
* Single-colour applications.
* Small favicon/icon sizes.

Variants still to be produced or confirmed:

* A version for white and light backgrounds.
* A one-colour version that stays legible without the white/turquoise colour split.
* A simplified symbol-only version for favicons, app icons and PWA icons. Fine details such as the thin tips of the curved shapes may be lost below about 32px.

The logo must remain recognizable at small dimensions.

### Open item

The turquoise in the supplied logo appears softer than the canonical `#02D3CB`. Confirm the exact value in the source artwork and align either the palette or the logo so there is a single canonical turquoise.

---

# 64. ICONOGRAPHY

Icons should be:

* Minimal.
* Clean.
* Consistent.
* Geometric where appropriate.
* Easy to understand.

Avoid excessive decorative Islamic iconography.

Icons should support the interface rather than compete with the content.

---

# 65. IMAGERY

Photography should feel:

* Natural.
* Warm.
* Mature.
* Modest.
* Real.
* Calm.

Avoid imagery that resembles:

* Dating advertisements.
* Romantic lifestyle advertising.
* Excessive physical intimacy.
* Unrealistic luxury.
* Artificially perfect couples.

The visual language should focus more on:

* Home.
* Family.
* Reflection.
* Partnership.
* Conversation.
* Responsibility.
* Community.
* Everyday life.

When people are shown, imagery should represent Muslims naturally and respectfully.

---

# 66. DESIGN LANGUAGE AND UI COMPONENTS

The interface should feel more like a **serious private institution** than a social network.

Think:

**Private Islamic institution + modern digital product + thoughtful editorial publication.**

Do not think:

**Dating app + social media + gamification.**

The product should feel:

**Serious. Calm. Private. Mature. Islamic. Modern.**

Avoid the visual language of dating applications.

Do not build:

* Swipe cards.
* "Hot or not."
* Like counts.
* Follower counts.
* Public popularity metrics.
* Attractiveness scores.
* Endless profile browsing.

Use:

* Clear stages.
* Progress indicators.
* Spacious layouts.
* Strong typography.
* Minimal distractions.
* Privacy cues.
* Thoughtful copy.

The interface should communicate:

> **This is a serious process.**

### Component language

Cards should be:

* Clean.
* Spacious.
* Lightly rounded.
* Content-first.

Avoid excessive:

* Shadows.
* Gradients.
* Pills.
* Floating decorations.
* Animations.
* Gamification.

Buttons should be confident and simple.

Forms should feel deliberate rather than bureaucratic.

Progress indicators should clearly communicate advancement without turning the programme into a game.

---

# 67. MOTION & ANIMATION

Animation should be subtle.

Use motion for:

* Page transitions.
* Progress changes.
* Form feedback.
* Expanding sections.
* Match-stage transitions.
* Notifications.

Do not use:

* Excessive confetti.
* Game-like rewards.
* Bouncing UI.
* Constant motion.
* Attention-seeking animations.

The user should feel calm while using Baytul Wisaal.

Respect the user's reduced-motion setting.

---

# 68. LANDING PAGE

The landing page should immediately communicate the philosophy and establish the brand.

Primary headline:

> **Marriage is a big deal. Treat it like one.**

Supporting message:

> Baytul Wisaal is a structured marriage-readiness and matchmaking platform designed to help you think beyond attraction and prepare for the reality of building a family.

Primary CTA:

**Begin Your Journey**

Secondary CTA:

**How It Works**

Explain the process visually:

```text
PREPARE
   ↓
REFLECT
   ↓
DEFINE
   ↓
MATCH
   ↓
RESPOND
   ↓
PROCEED
```

Use NileBlue as the primary visual anchor, DeepAqua for supporting sections, Turquoise for carefully selected interactive moments, and SoftGold for subtle moments of warmth and significance.

---

# 69. MOBILE-FIRST EXPERIENCE

Although Baytul Wisaal is a web application, it must be designed mobile-first.

Requirements:

* Fully responsive.
* Touch-friendly.
* Fast on low-bandwidth connections.
* Comfortable on small screens.
* Excellent mobile text input.
* Long-form answer support.
* Optimized image sizes.
* PWA-ready architecture.

---

# PART VIII: SCOPE AND PRINCIPLES

# 70. MVP SCOPE

The first release should include:

### Authentication

* Registration.
* Login.
* Verification.
* Password recovery.

### Profiles

* Basic profile.
* Match profile.
* Preferences.

### Marriage Readiness

* 30-day programme.
* Lessons.
* Scenarios.
* Written responses.
* AI-assisted evaluation.
* Progress tracking.
* Human review.

### Matchmaking

* Eligibility.
* Filtering.
* Matching.
* Match history.
* Permanent pair exclusion.

### Post-Match

* Expectation form.
* Match response.
* Compatibility assessment.
* Pairing pass/failure.
* Next-stage architecture.

### Administration

* User management.
* Programme management.
* Scenario management.
* Rubric management.
* Assessment review.
* Match management.
* Moderation.
* Audit logs.

Messaging and later marriage procedures can be introduced after the core system has been validated.

---

# 71. NON-NEGOTIABLE PRODUCT RULES

### Rule 1

Baytul Wisaal is **not a dating app with Islamic branding.**

### Rule 2

The one-month preparation stage is central to the product.

### Rule 3

Assessment answers should test reasoning, not memorization.

### Rule 4

AI assists assessment. It does not independently make irreversible decisions.

### Rule 5

Users should not be able to easily copy assessment questions into external LLMs.

### Rule 6

Screenshot prevention should be treated as deterrence and detection, not as something a web browser can guarantee.

### Rule 7

Users should not be reduced to a single "marriage score."

### Rule 8

A failed pairing does not mean either person is a bad candidate. It means that particular pairing did not satisfy the requirements.

### Rule 9

Once a pairing is permanently closed, the system must prevent those two users from being matched again.

### Rule 10

Next.js is the frontend.

### Rule 11

NestJS is the backend.

### Rule 12

The frontend must never connect directly to PostgreSQL.

### Rule 13

The browser must never communicate directly with the AI provider.

### Rule 14

All important eligibility, assessment, matchmaking, compatibility, permission, and exclusion rules must be enforced server-side.

### Rule 15

Brand consistency must never override accessibility.

### Rule 16

Every feature must follow the same brand principle:

> **Baytul Wisaal should feel like a serious, private and carefully designed institution for people making one of the most consequential decisions of their lives.**

---

# 72. PRODUCT NORTH STAR

The entire product should ultimately serve one idea:

> **We want you to think beyond physique.**

Beyond the photograph.

Beyond attraction.

Beyond chemistry.

Beyond the excitement of meeting someone new.

Think about the home.

Think about the children.

Think about money.

Think about religion.

Think about responsibility.

Think about conflict.

Think about the difficult years.

Think about the ordinary Tuesday nights.

Think about who this person will be when life stops being exciting.

And think about who **you** will be.

Because marriage is not simply finding someone you want.

It is finding someone with whom you can seriously consider building a life.

**Baytul Wisaal should treat marriage as seriously as marriage deserves to be treated.**

---

# 73. BRAND QUICK REFERENCE

## Baytul Wisaal Brand Palette

**NileBlue**
`#17334B`

Primary. Serious. Deep. Trustworthy.

**DeepAqua**
`#19687E`

Secondary. Calm. Refined. Approachable.

**Turquoise**
`#02D3CB`

Accent. Fresh. Interactive. Alive.

**SoftGold**
`#D9A441`

Accent. Warm. Valuable. Distinctive.

### Brand colour order

**NileBlue → DeepAqua → Turquoise → SoftGold**

### Brand feeling

**Seriousness + Trust + Warmth + Intentionality**

### Brand principle

> **Marriage is a big deal, and we are going to treat it as such.**

### Core product idea

> **Think beyond physique.**

---
id: framework.system-design
kind: framework
title: System design interviews
reviewed: 2026-11-01
---

## How system design interviews work {#overview}

System design interviews give an open-ended prompt, such as designing a URL shortener, a news feed or a ride-matching service, and look at how the candidate structures an ambiguous problem. There is no single right answer. A typical flow is: clarify requirements and expected scale, sketch the main components and how data moves between them, choose how data is stored, then go deeper on bottlenecks, failure handling and tradeoffs.

## Expectations for early-career candidates {#early-career}
levels: intern, entry
tags: system-design

Interns and entry-level candidates are rarely expected to design large distributed systems. Questions at this level usually focus on a small service or feature: defining an API, choosing a simple data model, explaining how a request moves through a web application, and spotting obvious bottlenecks. Clear reasoning and good questions matter more than knowing specific technologies.

## Expectations for mid-level candidates {#mid-level}
levels: mid
tags: system-design

Mid-level candidates are expected to drive the design with less prompting: estimate load, choose between relational and non-relational storage with reasons, add caching and queues where they help, and discuss consistency, availability and failure cases for the parts they designed.

## Expectations for senior and lead candidates {#senior-lead}
levels: senior, lead
tags: system-design, leadership

Senior and lead candidates are expected to lead the conversation, scope the problem themselves, compare several architectures, and reason about operations: monitoring, deployment, data migration, cost and security. Interviewers also look at how they would split the work across a team and which decisions they would revisit as the system grows.

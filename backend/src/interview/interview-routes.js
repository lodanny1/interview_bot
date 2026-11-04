const express = require("express");

function createInterviewRouter({
  requireActiveUser,
  repository,
  aiService,
  resumeContextService = null,
  getTargetJob = null,
  knowledgeService = null,
  logger = console,
}) {
  const router = express.Router();

  function toMessageResponse(message) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.created_at,
    };
  }

  function toSessionResponse(session, messages = []) {
    return {
      id: session.id,
      title: session.title,
      mode: session.mode,
      status: session.status,
      startedAt: session.started_at,
      endsAt: session.ends_at,
      durationMinutes: session.duration_minutes,
      completionReason: session.completion_reason,
      messages: messages.map(toMessageResponse),
    };
  }

  function validateStartInterview(body) {
    const fieldErrors = {};

    const goal =
      typeof body?.goal === "string"
        ? body.goal.trim()
        : "";

    const title =
      typeof body?.title === "string"
        ? body.title.trim()
        : "";

    const focusArea =
      typeof body?.focusArea === "string"
        ? body.focusArea.trim()
        : "";

    const mode =
      typeof body?.mode === "string"
        ? body.mode.trim()
        : "";

    if (!["general", "specific"].includes(goal)) {
      fieldErrors.goal = "Choose a practice goal.";
    }

    if (!title) {
      fieldErrors.title = "Enter an interview name.";
    } else if (title.length > 100) {
      fieldErrors.title =
        "Keep the name under 100 characters.";
    }

    if (!focusArea) {
      fieldErrors.focusArea =
        "Choose a focus area.";
    }

    if (!["text", "voice", "avatar"].includes(mode)) {
      fieldErrors.mode =
        "Choose a simulation mode.";
    }

    const jobDescription =
      typeof body?.jobDescription === "string"
        ? body.jobDescription.trim()
        : "";

    // Long text boxes share one 10,000-character limit across the app.
    if (jobDescription.length > 10000) {
      fieldErrors.jobDescription =
        "Keep the job description under 10,000 characters.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        fieldErrors,
      };
    }

    return {
      ok: true,
      data: {
        goal,
        title,
        focusArea,
        mode,
        industry:
          typeof body?.industry === "string" &&
          body.industry.trim()
            ? body.industry.trim()
            : null,
        roleLevel:
          typeof body?.roleLevel === "string" &&
          body.roleLevel.trim()
            ? body.roleLevel.trim()
            : null,
        experienceLevel:
          typeof body?.experienceLevel === "string" &&
          body.experienceLevel.trim()
            ? body.experienceLevel.trim()
            : null,
        jobDescription:
          jobDescription || null,
        resumeId:
          typeof body?.resumeId === "string" &&
          body.resumeId.trim()
            ? body.resumeId.trim()
            : null,
      },
    };
  }

  // The prompt inputs used before Issue #16: the role level as the role and
  // no company.
  function basicPromptInput({ roleLevel, focusArea }) {
    return {
      role: roleLevel,
      company: null,
      interviewType: focusArea,
    };
  }

  // Role & Company Knowledge Retrieval (Issue #16). With knowledgeService,
  // the interview uses the saved target job's title and company plus the
  // matching interview notes. The result is stored on the session so every
  // later question uses the same notes. Returns null without knowledgeService.
  async function prepareKnowledge(userId, setup) {
    if (!knowledgeService) {
      return null;
    }

    // "general" practice ignores the target job, so it isn't loaded.
    const targetJob =
      setup.goal === "specific" && getTargetJob
        ? await getTargetJob(userId)
        : null;

    const prepared =
      knowledgeService.prepareInterviewKnowledge({
        setup,
        targetJob,
      });

    return {
      promptInput: {
        ...prepared.promptInput,
        // Without a job title, keep the role level as before.
        role:
          prepared.promptInput.role ||
          setup.roleLevel,
      },
      knowledgeSummary:
        knowledgeService.knowledgeSummary(
          prepared.knowledge
        ),
    };
  }

  // The prompt input stored when the session started, or the basic one for
  // sessions started before prompt_input existed.
  function promptInputFor(session) {
    if (
      session.prompt_input &&
      typeof session.prompt_input === "object"
    ) {
      return session.prompt_input;
    }

    return basicPromptInput({
      roleLevel: session.role_level,
      focusArea: session.focus_area,
    });
  }

  // A closing needs no notes, only the same role, company and type.
  function closingInputFor(session) {
    const {
      role,
      company,
      interviewType,
    } = promptInputFor(session);

    return {
      role,
      company,
      interviewType,
    };
  }

  router.get("/interviews", async (req, res) => {
    const auth = await requireActiveUser(req);

    if (!auth.ok) {
      return res
        .status(auth.status)
        .json({ error: auth.error });
    }

    try {
      const sessions =
        await repository.listInterviewSessions(
          auth.user.id
        );

      return res.status(200).json({
        sessions: sessions.map((session) => ({
          id: session.id,
          title: session.title,
          mode: session.mode,
          industry: session.industry,
          role: session.role_level,
          status: session.status,
          durationMinutes:
            session.duration_minutes,
          startedAt: session.started_at,
          completedAt:
            session.completed_at,
          completionReason:
            session.completion_reason,
        })),
      });
    } catch (error) {
      logger.error(
        "GET /interviews failed:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to load interview history",
      });
    }
  });

  router.post("/interviews", async (req, res) => {
    const auth = await requireActiveUser(req);

    if (!auth.ok) {
      return res
        .status(auth.status)
        .json({ error: auth.error });
    }

    const validation =
      validateStartInterview(req.body);

    if (!validation.ok) {
      return res.status(400).json({
        error:
          "Some interview information is missing or invalid",
        fieldErrors: validation.fieldErrors,
      });
    }

    let session;

    try {
      const knowledge = await prepareKnowledge(
        auth.user.id,
        validation.data
      );

      const promptInput = knowledge
        ? knowledge.promptInput
        : basicPromptInput(validation.data);

      session =
        await repository.createInterviewSession({
          userId: auth.user.id,
          ...validation.data,
          ...(knowledge && {
            promptInput: knowledge.promptInput,
            knowledgeSummary:
              knowledge.knowledgeSummary,
          }),
        });

      const aiResponse =
        validation.data.resumeId
          ? await aiService.generateResumePersonalizedQuestion({
              userId: auth.user.id,
              resumeId: validation.data.resumeId,
              ...promptInput,
            })
          : await aiService.generateOpeningQuestion({
              ...promptInput,
              resumeContext: null,
            });

      const openingMessage =
        await repository.addInterviewMessage({
          sessionId: session.id,
          role: "interviewer",
          content: aiResponse.text,
        });

      return res.status(201).json({
        session: toSessionResponse(
          session,
          [openingMessage]
        ),
      });
    } catch (error) {
      logger.error(
        "POST /interviews failed:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to start interview session",
      });
    }
  });

  router.post(
    "/interviews/:id/messages",
    async (req, res) => {
      const auth =
        await requireActiveUser(req);

      if (!auth.ok) {
        return res
          .status(auth.status)
          .json({ error: auth.error });
      }

      const content =
        typeof req.body?.content === "string"
          ? req.body.content.trim()
          : "";

      if (!content) {
        return res.status(400).json({
          error: "Response content is required",
        });
      }

      try {
        const session =
          await repository.getInterviewSession(
            auth.user.id,
            req.params.id
          );

        if (!session) {
          return res.status(404).json({
            error:
              "Interview session not found",
          });
        }

        if (session.status !== "ACTIVE") {
          return res.status(409).json({
            error:
              "Interview session is not active",
          });
        }

        const candidateMessage =
          await repository.addInterviewMessage({
            sessionId: session.id,
            role: "candidate",
            content,
          });

        const transcript =
          await repository.getInterviewMessages(
            session.id
          );

        const conversation =
          transcript.map((message) => ({
            role:
              message.role === "interviewer"
                ? "assistant"
                : "user",
            content: message.content,
          }));

        const timeState =
          repository.getInterviewTimeState
            ? await repository.getInterviewTimeState(
                auth.user.id,
                session.id
              )
            : { expired: false };

        if (timeState?.expired) {
          const closingResponse =
            await aiService.generateClosingStatement({
              ...closingInputFor(session),
              conversation,
            });

          const closingMessage =
            await repository.addInterviewMessage({
              sessionId: session.id,
              role: "interviewer",
              content: closingResponse.text,
            });

          await repository.completeInterviewSession({
            userId: auth.user.id,
            sessionId: session.id,
            reason: "TIME_LIMIT",
          });

          return res.status(201).json({
            messages: [
              toMessageResponse(
                candidateMessage
              ),
              toMessageResponse(
                closingMessage
              ),
            ],
            completed: true,
            completionReason: "TIME_LIMIT",
          });
        }

        let resumeContext = null;

        if (
          session.resume_id &&
          resumeContextService
        ) {
          const resumeResult =
            await resumeContextService.getResumeContext({
              userId: auth.user.id,
              resumeId: session.resume_id,
            });

          resumeContext = JSON.stringify(
            resumeResult.context,
            null,
            2
          );
        }

        const aiResponse =
          await aiService.generateFollowUpQuestion({
            ...promptInputFor(session),
            resumeContext,
            conversation,
          });

        const interviewerMessage =
          await repository.addInterviewMessage({
            sessionId: session.id,
            role: "interviewer",
            content: aiResponse.text,
          });

        return res.status(201).json({
          messages: [
            toMessageResponse(
              candidateMessage
            ),
            toMessageResponse(
              interviewerMessage
            ),
          ],
        });
      } catch (error) {
        logger.error(
          "POST /interviews/:id/messages failed:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to submit interview response",
        });
      }
    }
  );

  router.post(
    "/interviews/:id/complete",
    async (req, res) => {
      const auth =
        await requireActiveUser(req);

      if (!auth.ok) {
        return res
          .status(auth.status)
          .json({ error: auth.error });
      }

      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason.trim()
          : "USER_ENDED";

      try {
        const session =
          await repository.getInterviewSession(
            auth.user.id,
            req.params.id
          );

        if (!session) {
          return res.status(404).json({
            error:
              "Interview session not found",
          });
        }

        if (session.status !== "ACTIVE") {
          return res.status(409).json({
            error:
              "Interview session is not active",
          });
        }

        let closingMessage = null;

        if (
          reason === "USER_ENDED" ||
          reason === "TIME_LIMIT"
        ) {
          const transcript =
            await repository.getInterviewMessages(
              session.id
            );

          const conversation =
            transcript.map((message) => ({
              role:
                message.role === "interviewer"
                  ? "assistant"
                  : "user",
              content: message.content,
            }));

          if (conversation.length > 0) {
            const closingResponse =
              await aiService.generateClosingStatement({
                ...closingInputFor(session),
                conversation,
              });

            closingMessage =
              await repository.addInterviewMessage({
                sessionId: session.id,
                role: "interviewer",
                content: closingResponse.text,
              });
          }
        }

        const completed =
          await repository.completeInterviewSession({
            userId: auth.user.id,
            sessionId: session.id,
            reason,
          });

        if (!completed) {
          return res.status(409).json({
            error:
              "Interview session could not be completed",
          });
        }

        return res.status(200).json({
          session: toSessionResponse(
            completed,
            closingMessage
              ? [closingMessage]
              : []
          ),
          messages: closingMessage
            ? [
                toMessageResponse(
                  closingMessage
                ),
              ]
            : [],
        });
      } catch (error) {
        logger.error(
          "POST /interviews/:id/complete failed:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to complete interview session",
        });
      }
    }
  );

  router.get(
    "/interviews/:id",
    async (req, res) => {
      const auth =
        await requireActiveUser(req);

      if (!auth.ok) {
        return res
          .status(auth.status)
          .json({ error: auth.error });
      }

      try {
        const session =
          await repository.getInterviewSession(
            auth.user.id,
            req.params.id
          );

        if (!session) {
          return res.status(404).json({
            error:
              "Interview session not found",
          });
        }

        const messages =
          await repository.getInterviewMessages(
            session.id
          );

        return res.status(200).json({
          session: toSessionResponse(
            session,
            messages
          ),
        });
      } catch (error) {
        logger.error(
          "GET /interviews/:id failed:",
          error
        );

        return res.status(500).json({
          error:
            "Unable to load interview session",
        });
      }
    }
  );

  return router;
}

module.exports = {
  createInterviewRouter,
};

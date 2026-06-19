import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadChatAttachment } from "../../middleware/uploadChatAttachment.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  getConversation,
  getConversationMessages,
  listMyConversations,
  markRead,
  sendAttachment,
  sendMessage,
  startConversation,
} from "./chat.controller.js";
import {
  conversationIdParamValidator,
  sendMessageValidator,
  startConversationValidator,
} from "./chat.validators.js";

const router = Router();

// Chat is only between clients and lawyers — registrars/admins have no
// conversations. Gate the whole router to those two roles; per-conversation
// participation is then enforced in the service on every request.
router.use(authenticate);
router.use(authorizeRoles("lawyer", "client"));

// GET /api/chat/conversations -> { conversations }
router.get("/conversations", asyncHandler(listMyConversations));

// POST /api/chat/conversations -> { conversation }  (client starts/reopens)
router.post(
  "/conversations",
  startConversationValidator,
  validateRequest,
  asyncHandler(startConversation)
);

// GET /api/chat/conversations/:conversationId -> { conversation }
router.get(
  "/conversations/:conversationId",
  conversationIdParamValidator,
  validateRequest,
  asyncHandler(getConversation)
);

// GET /api/chat/conversations/:conversationId/messages -> { messages }
router.get(
  "/conversations/:conversationId/messages",
  conversationIdParamValidator,
  validateRequest,
  asyncHandler(getConversationMessages)
);

// POST /api/chat/conversations/:conversationId/messages -> { message }
router.post(
  "/conversations/:conversationId/messages",
  sendMessageValidator,
  validateRequest,
  asyncHandler(sendMessage)
);

// POST /api/chat/conversations/:conversationId/attachments -> { message }
// Multipart upload (field "file"); the middleware parses it before we run the
// param validator. Used for documents and voice notes.
router.post(
  "/conversations/:conversationId/attachments",
  uploadChatAttachment,
  conversationIdParamValidator,
  validateRequest,
  asyncHandler(sendAttachment)
);

// POST /api/chat/conversations/:conversationId/read -> { read: true }
router.post(
  "/conversations/:conversationId/read",
  conversationIdParamValidator,
  validateRequest,
  asyncHandler(markRead)
);

export default router;

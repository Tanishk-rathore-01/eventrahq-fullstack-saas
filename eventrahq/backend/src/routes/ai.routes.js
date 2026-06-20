import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import { requireFields, safeString } from '../utils/validators.js';

export const aiRouter = express.Router();

function fallbackBrief({ title, audience, goal }) {
  return {
    provider: 'fallback-engine',
    brief: `${title} should be positioned as a premium, outcome-driven event for ${audience}. The core goal is ${goal}. Lead with a clear promise, a strong agenda, and a frictionless registration path.`,
    agenda: [
      'Opening keynote with event promise and audience outcome',
      'Expert session focused on practical implementation',
      'Interactive workshop with attendee participation',
      'Networking block with guided prompts',
      'Closing recap with next-step action plan'
    ],
    risks: [
      'Low registration conversion if landing copy is vague',
      'Weak attendee retention if agenda blocks are too long',
      'Operational bottlenecks at check-in without queue planning'
    ],
    marketingAngles: [
      'Outcome-first positioning',
      'Scarcity-driven registration copy',
      'Speaker credibility and agenda clarity'
    ]
  };
}

aiRouter.post('/event-brief', requireAuth, requireRole('admin', 'organizer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'audience', 'goal']);
  const payload = {
    title: safeString(req.body.title, 120),
    audience: safeString(req.body.audience, 180),
    goal: safeString(req.body.goal, 220)
  };

  const prompt = `Generate a concise professional event strategy brief as valid JSON only. Fields: brief string, agenda array of 5 strings, risks array of 3 strings, marketingAngles array of 3 strings. Event title: ${payload.title}. Audience: ${payload.audience}. Goal: ${payload.goal}.`;

  if (env.geminiApiKey) {
    try {
      const genAI = new GoogleGenerativeAI(env.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      res.json({ status: 'success', provider: 'gemini', ...parsed });
      return;
    } catch (error) {
      // fallback intentionally prevents AI provider failure from breaking the app demo
    }
  }

  if (env.openaiApiKey) {
    try {
      const client = new OpenAI({ apiKey: env.openaiApiKey });
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      res.json({ status: 'success', provider: 'openai', ...parsed });
      return;
    } catch (error) {
      // fallback intentionally prevents AI provider failure from breaking the app demo
    }
  }

  res.json({ status: 'success', ...fallbackBrief(payload) });
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const settingsList = await prisma.setting.findMany({
      where: { userId },
    });

    // Map list of settings to key-value object
    const settingsObj: Record<string, string> = {};
    settingsList.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
}

export async function updateSetting(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { key, value } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existing = await prisma.setting.findFirst({
      where: { userId, key },
    });

    if (existing) {
      const updated = await prisma.setting.update({
        where: { id: existing.id },
        data: { value: String(value) },
      });
      return res.json(updated);
    } else {
      const created = await prisma.setting.create({
        data: {
          key,
          value: String(value),
          userId,
        },
      });
      return res.json(created);
    }
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
}

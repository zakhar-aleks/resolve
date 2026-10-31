import type { PrivacyProfile } from '@resolve/contracts';
import { COPY } from '../consts/copy';
import { interpolate } from '../utils/interpolate';
export function privacyPresentation(profile: PrivacyProfile) {
  return {
    progress: interpolate(COPY.privacy.progress, {
      complete: profile.tasks.filter((task) => task.confirmed).length,
      total: profile.tasks.length,
    }),
    draft:
      !profile.legalName.trim() ||
      !profile.address.trim() ||
      !profile.privacyEmail ||
      profile.lawfulBasis === 'undecided' ||
      !profile.hostingLocation.trim(),
  };
}
export function noticeSections(profile: Omit<PrivacyProfile, 'tasks' | 'revision'>) {
  const text = COPY.privacy;
  return [
    { title: text.dataTitle, body: text.dataBody },
    { title: text.purposeTitle, body: text.purposeBody },
    {
      title: text.aiTitle,
      body: (profile.aiEnabled ? text.aiOn : text.aiOff) + ' ' + text.aiChoice,
    },
    { title: text.sharingTitle, body: text.sharingBody },
    {
      title: text.retentionTitle,
      body: interpolate(text.retentionTemplate, { days: profile.retentionDays }),
    },
    { title: text.rightsTitle, body: text.rightsBody },
    { title: text.globalTitle, body: text.globalBody },
    { title: text.changesTitle, body: text.changesBody },
  ];
}

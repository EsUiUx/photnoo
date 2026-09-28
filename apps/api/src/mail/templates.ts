import type { Mail } from './mail.service';

type Locale = 'ar' | 'en';

// Plain-text transactional emails. Arabic first, English below, until branded HTML templates land.
export const templates = {
  applicationReceived(to: string, name: string): Mail {
    return {
      to,
      subject: 'Photnoo — استلمنا طلبك / We received your application',
      text: [
        `مرحبًا ${name}،`,
        'استلمنا طلب انضمامك إلى Photnoo وسنراجعه قريبًا.',
        '',
        `Hello ${name},`,
        'We received your application to join Photnoo and will review it shortly.',
      ].join('\n'),
    };
  },

  invite(to: string, name: string, inviteUrl: string): Mail {
    return {
      to,
      subject: 'Photnoo — تمت الموافقة على طلبك / You are invited',
      text: [
        `مرحبًا ${name}،`,
        'تمت الموافقة على طلبك. أنشئ حسابك خلال 7 أيام من هذا الرابط:',
        inviteUrl,
        '',
        `Hello ${name},`,
        'Your application was approved. Create your account within 7 days:',
        inviteUrl,
      ].join('\n'),
    };
  },

  applicationRejected(to: string, name: string, reason: string): Mail {
    return {
      to,
      subject: 'Photnoo — بخصوص طلبك / About your application',
      text: [
        `مرحبًا ${name}،`,
        'شكرًا لاهتمامك بـ Photnoo. لم نتمكن من قبول طلبك الآن.',
        `السبب: ${reason}`,
        'يمكنك التقديم مرة أخرى لاحقًا.',
        '',
        `Hello ${name},`,
        'Thank you for your interest in Photnoo. We could not accept your application at this time.',
        `Reason: ${reason}`,
        'You are welcome to apply again later.',
      ].join('\n'),
    };
  },

  linkLocked(to: string, galleryName: string): Mail {
    return {
      to,
      subject: 'Photnoo — تم قفل رابط المعرض مؤقتًا / Gallery link locked',
      text: [
        `تم إدخال كلمة مرور خاطئة 30 مرة خلال ساعة على المعرض "${galleryName}". أوقفنا الدخول لمدة ساعة.`,
        'إذا لم يكن ذلك عميلك، أنشئ كلمة مرور جديدة من صفحة المعرض.',
        '',
        `Someone entered a wrong password 30 times in an hour on "${galleryName}". Logins are paused for one hour.`,
        'If this was not your client, create a new password from the gallery page.',
      ].join('\n'),
    };
  },

  galleryThrottled(to: string, galleryName: string): Mail {
    return {
      to,
      subject: 'Photnoo — تم إيقاف التحميل مؤقتًا / Downloads paused',
      text: [
        `تجاوز المعرض "${galleryName}" حد التحميل الآمن خلال ساعة، فأوقفنا التحميل لمدة ساعة.`,
        '',
        `"${galleryName}" served more than the safe amount in one hour, so downloads are paused for one hour.`,
        'If the link was shared beyond your client, close the gallery or create a new password.',
      ].join('\n'),
    };
  },

  resetCode(to: string, code: string, locale: Locale): Mail {
    const ar = [`رمز إعادة تعيين كلمة المرور: ${code}`, 'صالح لمدة 10 دقائق. إذا لم تطلب ذلك، تجاهل هذه الرسالة.'];
    const en = [`Your password reset code: ${code}`, 'It is valid for 10 minutes. If you did not ask for it, ignore this email.'];
    return {
      to,
      subject: locale === 'ar' ? 'Photnoo — رمز إعادة التعيين' : 'Photnoo — password reset code',
      text: (locale === 'ar' ? [...ar, '', ...en] : [...en, '', ...ar]).join('\n'),
    };
  },

  paymentApproved(to: string, reference: string, planLabel: string, until: string, invoice: string): Mail {
    return {
      to,
      subject: 'Photnoo — تم تأكيد الدفع / Payment confirmed',
      text: [
        `تم تأكيد دفعتك ${reference}. باقة ${planLabel} مفعلة حتى ${until}.`,
        `الفاتورة ${invoice} متاحة في صفحة الفواتير.`,
        '',
        `Your payment ${reference} is confirmed. The ${planLabel} plan is active until ${until}.`,
        `Invoice ${invoice} is in Billing.`,
      ].join('\n'),
    };
  },

  paymentRejected(to: string, reference: string, reason: string): Mail {
    return {
      to,
      subject: 'Photnoo — لم نتمكن من تأكيد الدفع / Payment not confirmed',
      text: [
        `لم نتمكن من تأكيد الدفعة ${reference}.`,
        `السبب: ${reason}`,
        'يمكنك رفع إثبات جديد من صفحة الفواتير.',
        '',
        `We could not confirm payment ${reference}.`,
        `Reason: ${reason}`,
        'You can upload a new proof from Billing.',
      ].join('\n'),
    };
  },

  renewalReminder(to: string, days: number, until: string, trial: boolean): Mail {
    const when = days === 0 ? 'today' : `in ${days} days`;
    const whenAr = days === 0 ? 'اليوم' : `خلال ${days} يومًا`;
    return {
      to,
      subject: trial ? 'Photnoo — الفترة التجريبية تنتهي قريبًا / Your trial ends soon' : 'Photnoo — موعد التجديد / Renewal reminder',
      text: [
        trial ? `تنتهي فترتك التجريبية ${whenAr} (${until}). اختر باقة لتستمر في الرفع.` : `ينتهي اشتراكك ${whenAr} (${until}). جدده لتستمر في الرفع وإنشاء المعارض.`,
        'المعارض المفعلة تستمر حتى موعد انتهائها.',
        '',
        trial ? `Your trial ends ${when} (${until}). Choose a plan to keep uploading.` : `Your plan ends ${when} (${until}). Renew to keep uploading and creating galleries.`,
        'Galleries already shared keep working until their own expiry.',
      ].join('\n'),
    };
  },

  softLocked(to: string): Mail {
    return {
      to,
      subject: 'Photnoo — انتهى اشتراكك / Your plan has ended',
      text: [
        'انتهى اشتراكك. يمكنك الدخول ورؤية معارضك، لكن الرفع وإنشاء معارض جديدة متوقف حتى التجديد.',
        '',
        'Your plan has ended. You can still log in and see your galleries, but uploads and new galleries are paused until you renew.',
      ].join('\n'),
    };
  },

  allowanceWarning(to: string, percent: number, used: string, total: string): Mail {
    const full = percent >= 100;
    return {
      to,
      subject: full ? 'Photnoo — اكتمل رصيد الرفع / Upload allowance used up' : `Photnoo — استخدمت ${percent}% من الرصيد / ${percent}% of your allowance used`,
      text: [
        full
          ? `استخدمت كل رصيد الرفع (${used} من ${total}). الرفع متوقف حتى الترقية أو التجديد. المعارض المفعلة لا تتأثر.`
          : `استخدمت ${percent}% من رصيد الرفع (${used} من ${total}).`,
        '',
        full
          ? `You have used all of your upload allowance (${used} of ${total}). Uploads are paused until you upgrade or renew. Shared galleries are not affected.`
          : `You have used ${percent}% of your upload allowance (${used} of ${total}).`,
      ].join('\n'),
    };
  },
};

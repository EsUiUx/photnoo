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

  resetCode(to: string, code: string, locale: Locale): Mail {
    const ar = [`رمز إعادة تعيين كلمة المرور: ${code}`, 'صالح لمدة 10 دقائق. إذا لم تطلب ذلك، تجاهل هذه الرسالة.'];
    const en = [`Your password reset code: ${code}`, 'It is valid for 10 minutes. If you did not ask for it, ignore this email.'];
    return {
      to,
      subject: locale === 'ar' ? 'Photnoo — رمز إعادة التعيين' : 'Photnoo — password reset code',
      text: (locale === 'ar' ? [...ar, '', ...en] : [...en, '', ...ar]).join('\n'),
    };
  },
};

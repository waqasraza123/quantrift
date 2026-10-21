import asyncio
import smtplib
import ssl
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from app.config import Settings


class VerificationEmailDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class VerificationEmail:
    recipient_email: str
    recipient_name: str
    verification_url: str
    expires_at: datetime


class VerificationEmailProvider(ABC):
    @abstractmethod
    async def send_verification_email(self, email: VerificationEmail) -> None:
        raise NotImplementedError


class DisabledVerificationEmailProvider(VerificationEmailProvider):
    async def send_verification_email(self, email: VerificationEmail) -> None:
        raise VerificationEmailDeliveryError("Verification email provider is not configured")


class SmtpVerificationEmailProvider(VerificationEmailProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_verification_email(self, email: VerificationEmail) -> None:
        try:
            await asyncio.to_thread(self._send, email)
        except VerificationEmailDeliveryError:
            raise
        except Exception as error:
            raise VerificationEmailDeliveryError("Verification email delivery failed") from error

    def _send(self, email: VerificationEmail) -> None:
        host = self.settings.auth_smtp_host
        from_address = self.settings.auth_email_from_address
        if not host or not from_address:
            raise VerificationEmailDeliveryError("SMTP verification email settings are incomplete")
        message = EmailMessage()
        message["Subject"] = "Verify your QuantRift email"
        message["From"] = formataddr((self.settings.auth_email_from_name, from_address))
        message["To"] = formataddr((email.recipient_name, email.recipient_email))
        message["Message-ID"] = make_msgid(domain=from_address.split("@")[-1])
        message.set_content(
            "Welcome to QuantRift. Verify your email address to activate sign-in:\n\n"
            f"{email.verification_url}\n\n"
            f"This link expires at {email.expires_at.isoformat()}. "
            "If you did not create this account, you can ignore this email."
        )
        message.add_alternative(
            "<p>Welcome to QuantRift.</p>"
            "<p>Verify your email address to activate sign-in:</p>"
            f'<p><a href="{email.verification_url}">Verify email address</a></p>'
            f"<p>This link expires at {email.expires_at.isoformat()}.</p>"
            "<p>If you did not create this account, you can ignore this email.</p>",
            subtype="html",
        )
        ssl_context = ssl.create_default_context()
        smtp: smtplib.SMTP
        if self.settings.auth_smtp_use_ssl:
            smtp = smtplib.SMTP_SSL(
                host=host,
                port=self.settings.auth_smtp_port,
                timeout=self.settings.auth_smtp_timeout_seconds,
                context=ssl_context,
            )
        else:
            smtp = smtplib.SMTP(
                host=host,
                port=self.settings.auth_smtp_port,
                timeout=self.settings.auth_smtp_timeout_seconds,
            )
        with smtp:
            if self.settings.auth_smtp_use_tls:
                smtp.starttls(context=ssl_context)
            username = self.settings.auth_smtp_username
            password = self.settings.auth_smtp_password
            if username and password is not None:
                smtp.login(username, password.get_secret_value())
            refused = smtp.send_message(message)
            if refused:
                raise VerificationEmailDeliveryError("SMTP rejected the verification recipient")


def create_verification_email_provider(settings: Settings) -> VerificationEmailProvider:
    if settings.auth_email_provider == "smtp":
        return SmtpVerificationEmailProvider(settings)
    return DisabledVerificationEmailProvider()

import asyncio
import html
import smtplib
import ssl
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import httpx

from app.config import Settings

RESEND_EMAILS_URL = "https://api.resend.com/emails"


class VerificationEmailDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class VerificationEmail:
    delivery_id: str
    recipient_email: str
    recipient_name: str
    verification_url: str
    expires_at: datetime
    workspace_name: str | None = None


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
        message["Subject"] = email_subject(email)
        message["From"] = formataddr((self.settings.auth_email_from_name, from_address))
        message["To"] = formataddr((email.recipient_name, email.recipient_email))
        message["Message-ID"] = make_msgid(domain=from_address.split("@")[-1])
        message.set_content(verification_email_text(email))
        message.add_alternative(verification_email_html(email), subtype="html")
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


class ResendVerificationEmailProvider(VerificationEmailProvider):
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self.client = client

    async def send_verification_email(self, email: VerificationEmail) -> None:
        api_key = self.settings.resend_api_key
        from_address = self.settings.auth_email_from_address
        if api_key is None or not api_key.get_secret_value().strip() or not from_address:
            raise VerificationEmailDeliveryError(
                "Resend verification email settings are incomplete"
            )
        request_headers = {
            "Authorization": f"Bearer {api_key.get_secret_value()}",
            "Content-Type": "application/json",
            "Idempotency-Key": (
                f"workspace-invitation/{email.delivery_id}" if email.workspace_name
                else f"email-verification/{email.delivery_id}"
            ),
        }
        request_body = {
            "from": formataddr((self.settings.auth_email_from_name, from_address)),
            "to": [email.recipient_email],
            "subject": email_subject(email),
            "text": verification_email_text(email),
            "html": verification_email_html(email),
            "tags": [{"name": "category", "value": "workspace_invitation" if email.workspace_name else "email_verification"}],
        }
        try:
            if self.client is not None:
                response = await self.client.post(
                    RESEND_EMAILS_URL,
                    headers=request_headers,
                    json=request_body,
                )
            else:
                async with httpx.AsyncClient(
                    timeout=self.settings.resend_timeout_seconds
                ) as client:
                    response = await client.post(
                        RESEND_EMAILS_URL,
                        headers=request_headers,
                        json=request_body,
                    )
        except httpx.HTTPError as error:
            raise VerificationEmailDeliveryError(
                "Resend verification email delivery failed"
            ) from error
        if not response.is_success:
            raise VerificationEmailDeliveryError("Resend rejected the verification email")
        try:
            response_payload = response.json()
        except ValueError as error:
            raise VerificationEmailDeliveryError("Resend returned an invalid response") from error
        provider_message_id = (
            response_payload.get("id") if isinstance(response_payload, dict) else None
        )
        if not isinstance(provider_message_id, str) or not provider_message_id.strip():
            raise VerificationEmailDeliveryError(
                "Resend did not confirm verification email delivery"
            )


def email_subject(email: VerificationEmail) -> str:
    return "You're invited to a QuantRift workspace" if email.workspace_name else "Verify your QuantRift email"


def verification_email_text(email: VerificationEmail) -> str:
    if email.workspace_name:
        return (f"You are invited to join {email.workspace_name} on QuantRift.\n\n"
                f"Sign in or create an account with {email.recipient_email}, then accept:\n\n"
                f"{email.verification_url}\n\nThis link expires at {email.expires_at.isoformat()}. "
                "If you were not expecting this invitation, ignore this email.")
    return (
        f"Hello {email.recipient_name},\n\n"
        "Verify your email address to activate your QuantRift account:\n\n"
        f"{email.verification_url}\n\n"
        f"This link expires at {email.expires_at.isoformat()}. "
        "If you did not create this account, you can ignore this email."
    )


def verification_email_html(email: VerificationEmail) -> str:
    if email.workspace_name:
        return (f"<h1>Join {html.escape(email.workspace_name)}</h1>"
                "<p>Sign in or create an account with the email address that received this invitation.</p>"
                f'<p><a href="{html.escape(email.verification_url, quote=True)}">Accept invitation</a></p>'
                f"<p>Expires at {html.escape(email.expires_at.isoformat())}. "
                "If this was unexpected, ignore this email.</p>")
    recipient_name = html.escape(email.recipient_name)
    verification_url = html.escape(email.verification_url, quote=True)
    expires_at = html.escape(email.expires_at.isoformat())
    return (
        '<div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,sans-serif;'
        'color:#18202a">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e7eb;'
        'border-radius:16px;padding:32px">'
        '<p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:.12em;'
        'text-transform:uppercase;color:#52606d">QuantRift</p>'
        f'<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">'
        f"Welcome, {recipient_name}</h1>"
        '<p style="margin:0 0 24px;line-height:1.6;color:#52606d">Verify your email address to '
        "activate secure sign-in for your account.</p>"
        f'<p style="margin:0 0 24px"><a href="{verification_url}" style="display:inline-block;'
        'background:#172b4d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;'
        'border-radius:10px">Verify email address</a></p>'
        f'<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#7b8794">This link expires '
        f"at {expires_at}.</p>"
        '<p style="margin:0;font-size:13px;line-height:1.5;color:#7b8794">If you did not create '
        "this account, you can ignore this email.</p>"
        "</div></div>"
    )


def create_verification_email_provider(settings: Settings) -> VerificationEmailProvider:
    if settings.auth_email_provider == "resend":
        return ResendVerificationEmailProvider(settings)
    if settings.auth_email_provider == "smtp":
        return SmtpVerificationEmailProvider(settings)
    return DisabledVerificationEmailProvider()

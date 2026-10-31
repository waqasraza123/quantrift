from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.columns import created_at_column, updated_at_column, uuid_primary_key


class AuthMfaFactor(Base):
    __tablename__ = "auth_mfa_factors"
    __table_args__ = (
        CheckConstraint("version >= 1", name="auth_mfa_factor_version_positive"),
        CheckConstraint("failed_attempts >= 0", name="auth_mfa_factor_attempts_nonnegative"),
        Index("ix_auth_mfa_factor_workspace_user", "workspace_id", "user_id"),
    )

    credential_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("auth_password_credentials.id", ondelete="CASCADE"), primary_key=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    secret_ciphertext: Mapped[str | None] = mapped_column(Text)
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_counter: Mapped[int | None] = mapped_column(BigInteger)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()
    updated_at = updated_at_column()


class AuthMfaChallenge(Base):
    __tablename__ = "auth_mfa_challenges"
    __table_args__ = (
        CheckConstraint("purpose in ('enroll', 'verify', 'replace')", name="auth_mfa_challenge_purpose"),
        CheckConstraint("attempts >= 0", name="auth_mfa_challenge_attempts"),
        Index("ix_auth_mfa_challenge_credential", "credential_id", "created_at"),
        Index("ix_auth_mfa_challenge_expires", "expires_at"),
    )

    id = uuid_primary_key()
    credential_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("auth_password_credentials.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    password_fingerprint: Mapped[str] = mapped_column(String(64))
    purpose: Mapped[str] = mapped_column(String(16))
    factor_version: Mapped[int] = mapped_column(Integer)
    secret_ciphertext: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()


class AuthMfaRecoveryCode(Base):
    __tablename__ = "auth_mfa_recovery_codes"
    __table_args__ = (Index("ix_auth_mfa_recovery_credential", "credential_id"),)

    id = uuid_primary_key()
    credential_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("auth_password_credentials.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at = created_at_column()

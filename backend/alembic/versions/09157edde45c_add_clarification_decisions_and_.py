"""add_clarification_decisions_and_permission_rules

Revision ID: 09157edde45c
Revises: 66e2d97abc85
Create Date: 2026-09-30 04:55:55.494738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09157edde45c'
down_revision: Union[str, Sequence[str], None] = '66e2d97abc85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create clarification_decisions and permission_rules tables."""
    op.create_table(
        'clarification_decisions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('requirement_id', sa.String(length=50), nullable=True),
        sa.Column('issue_type', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('suggested_question', sa.Text(), nullable=False),
        sa.Column('decision', sa.String(length=30), nullable=False, server_default='pending'),
        sa.Column('reviewer_answer', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        'ix_clarification_decisions_project_id',
        'clarification_decisions',
        ['project_id'],
        unique=False
    )

    op.create_table(
        'permission_rules',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('condition', sa.Text(), nullable=True),
        sa.Column('decision', sa.String(length=20), nullable=False, server_default='allow'),
        sa.Column('source_requirement_id', sa.String(length=50), nullable=True),
        sa.Column('source_rule_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        'ix_permission_rules_project_role',
        'permission_rules',
        ['project_id', 'role'],
        unique=False
    )


def downgrade() -> None:
    """Drop the two new tables."""
    op.drop_index('ix_permission_rules_project_role', table_name='permission_rules')
    op.drop_table('permission_rules')
    op.drop_index('ix_clarification_decisions_project_id', table_name='clarification_decisions')
    op.drop_table('clarification_decisions')

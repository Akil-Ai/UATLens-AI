"""auth_project_access_permissions_clarifications

Revision ID: 2b3c4d5e6f7a
Revises: 09157edde45c
Create Date: 2026-09-30 05:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '2b3c4d5e6f7a'
down_revision: Union[str, Sequence[str], None] = '09157edde45c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Projects table alterations
    op.add_column('projects', sa.Column('owner_id', sa.String(length=36), nullable=True))
    op.create_index('ix_projects_owner_id', 'projects', ['owner_id'], unique=False)
    op.add_column('projects', sa.Column('current_suite_version', sa.Integer(), server_default='1', nullable=False))

    # 2. Project Members table
    op.create_table(
        'project_members',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('user_email', sa.String(length=255), nullable=True),
        sa.Column('role', sa.String(length=30), server_default='viewer', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_members_lookup', 'project_members', ['project_id', 'user_id'], unique=True)
    op.create_index('ix_project_members_user_id', 'project_members', ['user_id'], unique=False)

    # 3. Test Suite Versions table
    op.create_table(
        'test_suite_versions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('version_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('model_provider', sa.String(length=50), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('target_requirement_id', sa.String(length=50), nullable=True),
        sa.Column('generation_inputs', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='Completed', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('test_case_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('snapshot', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_test_suite_versions_lookup', 'test_suite_versions', ['project_id', 'version_number'], unique=False)

    # 4. Test Cases additions
    op.add_column('test_cases', sa.Column('permission_rule_ids', sa.JSON(), nullable=True))
    op.add_column('test_cases', sa.Column('permission_rule_revision', sa.Integer(), nullable=True))
    op.add_column('test_cases', sa.Column('is_blocked', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('test_cases', sa.Column('blocked_reason', sa.Text(), nullable=True))

    # 5. Permission Rules additions
    op.add_column('permission_rules', sa.Column('resource', sa.String(length=150), nullable=True))
    op.add_column('permission_rules', sa.Column('scope', sa.String(length=100), nullable=True))
    op.add_column('permission_rules', sa.Column('workflow_state', sa.String(length=100), nullable=True))
    op.add_column('permission_rules', sa.Column('source_quote', sa.Text(), nullable=True))
    op.add_column('permission_rules', sa.Column('source_location', sa.String(length=150), nullable=True))
    op.add_column('permission_rules', sa.Column('review_status', sa.String(length=30), server_default='Draft', nullable=False))
    op.add_column('permission_rules', sa.Column('reviewer_notes', sa.Text(), nullable=True))
    op.add_column('permission_rules', sa.Column('revision', sa.Integer(), server_default='1', nullable=False))
    op.add_column('permission_rules', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('permission_rules', sa.Column('superseded_by_id', sa.String(length=36), nullable=True))
    op.add_column('permission_rules', sa.Column('evidence', sa.JSON(), nullable=True))
    op.add_column('permission_rules', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_permission_rules_decision', 'permission_rules', ['project_id', 'decision'], unique=False)

    # 6. Clarification Decisions additions
    op.add_column('clarification_decisions', sa.Column('source_evidence', sa.Text(), nullable=True))
    op.add_column('clarification_decisions', sa.Column('document_location', sa.String(length=150), nullable=True))
    op.add_column('clarification_decisions', sa.Column('status', sa.String(length=30), server_default='Open', nullable=False))
    op.add_column('clarification_decisions', sa.Column('dismissal_reason', sa.Text(), nullable=True))
    op.add_column('clarification_decisions', sa.Column('answered_by', sa.String(length=100), nullable=True))
    op.add_column('clarification_decisions', sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clarification_decisions', sa.Column('confirmed_by', sa.String(length=100), nullable=True))
    op.add_column('clarification_decisions', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clarification_decisions', sa.Column('dismissed_by', sa.String(length=100), nullable=True))
    op.add_column('clarification_decisions', sa.Column('dismissed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clarification_decisions', sa.Column('reopened_by', sa.String(length=100), nullable=True))
    op.add_column('clarification_decisions', sa.Column('reopened_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clarification_decisions', sa.Column('history', sa.JSON(), nullable=True))
    op.add_column('clarification_decisions', sa.Column('is_superseded', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('clarification_decisions', sa.Column('superseded_by_id', sa.String(length=36), nullable=True))
    op.create_index('ix_clarification_decisions_status', 'clarification_decisions', ['project_id', 'status'], unique=False)

    # 7. Conservative Data Migration
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE clarification_decisions 
        SET status = 'Answered' 
        WHERE reviewer_answer IS NOT NULL AND TRIM(reviewer_answer) != ''
    """))
    conn.execute(sa.text("""
        UPDATE clarification_decisions 
        SET status = 'Dismissed', dismissal_reason = 'Historical rejection' 
        WHERE decision = 'rejected'
    """))
    conn.execute(sa.text("""
        UPDATE permission_rules 
        SET decision = 'Allowed' 
        WHERE lower(decision) = 'allow'
    """))
    conn.execute(sa.text("""
        UPDATE permission_rules 
        SET decision = 'Denied' 
        WHERE lower(decision) = 'deny'
    """))


def downgrade() -> None:
    op.drop_index('ix_clarification_decisions_status', table_name='clarification_decisions')
    op.drop_column('clarification_decisions', 'superseded_by_id')
    op.drop_column('clarification_decisions', 'is_superseded')
    op.drop_column('clarification_decisions', 'history')
    op.drop_column('clarification_decisions', 'reopened_at')
    op.drop_column('clarification_decisions', 'reopened_by')
    op.drop_column('clarification_decisions', 'dismissed_at')
    op.drop_column('clarification_decisions', 'dismissed_by')
    op.drop_column('clarification_decisions', 'confirmed_at')
    op.drop_column('clarification_decisions', 'confirmed_by')
    op.drop_column('clarification_decisions', 'answered_at')
    op.drop_column('clarification_decisions', 'answered_by')
    op.drop_column('clarification_decisions', 'dismissal_reason')
    op.drop_column('clarification_decisions', 'status')
    op.drop_column('clarification_decisions', 'document_location')
    op.drop_column('clarification_decisions', 'source_evidence')

    op.drop_index('ix_permission_rules_decision', table_name='permission_rules')
    op.drop_column('permission_rules', 'updated_at')
    op.drop_column('permission_rules', 'evidence')
    op.drop_column('permission_rules', 'superseded_by_id')
    op.drop_column('permission_rules', 'is_active')
    op.drop_column('permission_rules', 'revision')
    op.drop_column('permission_rules', 'reviewer_notes')
    op.drop_column('permission_rules', 'review_status')
    op.drop_column('permission_rules', 'source_location')
    op.drop_column('permission_rules', 'source_quote')
    op.drop_column('permission_rules', 'workflow_state')
    op.drop_column('permission_rules', 'scope')
    op.drop_column('permission_rules', 'resource')

    op.drop_column('test_cases', 'blocked_reason')
    op.drop_column('test_cases', 'is_blocked')
    op.drop_column('test_cases', 'permission_rule_revision')
    op.drop_column('test_cases', 'permission_rule_ids')

    op.drop_index('ix_test_suite_versions_lookup', table_name='test_suite_versions')
    op.drop_table('test_suite_versions')

    op.drop_index('ix_project_members_user_id', table_name='project_members')
    op.drop_index('ix_project_members_lookup', table_name='project_members')
    op.drop_table('project_members')

    op.drop_column('projects', 'current_suite_version')
    op.drop_index('ix_projects_owner_id', table_name='projects')
    op.drop_column('projects', 'owner_id')

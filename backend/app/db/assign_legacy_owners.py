"""
CLI Tool: Assign Legacy Projects to Authorized Owner.

Usage:
  # List all unassigned legacy projects:
  python -m backend.app.db.assign_legacy_owners --list

  # Assign specific project to owner:
  python -m backend.app.db.assign_legacy_owners --project-id <PROJECT_ID> --owner-id <USER_UUID> --email <EMAIL>

  # Assign all unassigned projects to owner:
  python -m backend.app.db.assign_legacy_owners --all --owner-id <USER_UUID> --email <EMAIL>
"""
import sys
import argparse
from backend.app.db.session import SessionLocal
from backend.app.models.entities import Project, ProjectMember


def main():
    parser = argparse.ArgumentParser(description="Assign legacy UATLens projects to authorized owners.")
    parser.add_argument("--list", action="store_true", help="List all unassigned projects")
    parser.add_argument("--project-id", type=str, help="Specific project ID to assign")
    parser.add_argument("--all", action="store_true", help="Assign all unassigned projects")
    parser.add_argument("--owner-id", type=str, help="Supabase User UUID for owner")
    parser.add_argument("--email", type=str, help="User email address")

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.list:
            unassigned = db.query(Project).filter(Project.owner_id == None).all()
            print(f"Found {len(unassigned)} unassigned legacy projects:")
            for p in unassigned:
                print(f" - ID: {p.id} | Name: '{p.name}' | Created: {p.created_at}")
            return

        if not args.owner_id:
            print("Error: --owner-id is required when assigning projects.")
            sys.exit(1)

        if args.project_id:
            projects = db.query(Project).filter(Project.id == args.project_id).all()
            if not projects:
                print(f"Error: Project '{args.project_id}' not found.")
                sys.exit(1)
        elif args.all:
            projects = db.query(Project).filter(Project.owner_id == None).all()
            if not projects:
                print("No unassigned projects found.")
                return
        else:
            print("Error: Specify either --project-id or --all (or use --list).")
            sys.exit(1)

        assigned_count = 0
        for p in projects:
            p.owner_id = args.owner_id
            # Upsert ProjectMember
            existing_member = db.query(ProjectMember).filter(
                ProjectMember.project_id == p.id,
                ProjectMember.user_id == args.owner_id
            ).first()
            if not existing_member:
                db.add(ProjectMember(
                    project_id=p.id,
                    user_id=args.owner_id,
                    user_email=args.email or "",
                    role="owner"
                ))
            else:
                existing_member.role = "owner"
            assigned_count += 1
            print(f"Assigned project '{p.id}' ('{p.name}') to owner {args.owner_id}")

        db.commit()
        print(f"Successfully assigned {assigned_count} project(s) to {args.owner_id}.")

    finally:
        db.close()


if __name__ == "__main__":
    main()

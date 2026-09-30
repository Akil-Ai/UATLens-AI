"""
Enterprise Role and Permission Analyzer.

Replaces brittle word-matching with structured semantic analysis:
- Handles exclusive permissions: "Only Admin can approve refunds" -> Admin: Allowed, Other Roles: Denied (NEVER Admin: Denied)
- Handles scope and ownership: "Employees can view only their own requests" -> Scope: 'own records' Allowed; other records Denied
- Identifies explicit denials, conditional permissions, and conflicting statements
- Preserves stable PR-001 IDs and reviewer revisions across repeat extraction
"""
import re
from typing import List, Dict, Any, Optional, Tuple, Set
from backend.app.models.entities import ExtractedContext, PermissionRule


def parse_action_and_condition(text: str) -> Tuple[str, Optional[str], Optional[str], Optional[str]]:
    """
    Extracts action, condition, workflow_state, and scope from a natural language phrase.
    """
    scope = "unspecified"
    condition = None
    workflow_state = None

    lower = text.lower()
    if "only their own" in lower or "strictly their own" in lower or "own records" in lower:
        scope = "own records"
    elif "all records" in lower or "any order" in lower:
        scope = "all records"

    # State condition
    state_match = re.search(r'(?:when|if|in)\s+(?:the\s+)?order\s+is\s+in\s+([A-Za-z\s]+?)(?:\s+status|\s+state|\.|$)', text, re.IGNORECASE)
    if state_match:
        workflow_state = state_match.group(1).strip()
        condition = f"In state: {workflow_state}"

    # Timing condition
    timing_match = re.search(r'(?:prior to|before)\s+([A-Za-z\s]+?)(?:\.|$)', text, re.IGNORECASE)
    if timing_match:
        condition = f"Prior to: {timing_match.group(1).strip()}"
        workflow_state = f"Before {timing_match.group(1).strip()}"

    # Threshold condition
    thresh_match = re.search(r'(?:under|below|less than|exceeding|over|minimum)\s+(\$?\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if thresh_match:
        thresh_cond = f"Amount condition: {thresh_match.group(0)}"
        condition = f"{condition}; {thresh_cond}" if condition else thresh_cond

    return text.strip(), condition, workflow_state, scope


def analyze_permissions_from_context(
    ctx: ExtractedContext,
    project_id: str,
    raw_document: str = ""
) -> List[Dict[str, Any]]:
    """
    Synthesizes explicit permission rules from extracted context and business rules.
    Guarantees:
    - Exclusive rules ("Only Admin...") produce Allowed for Admin, Denied for non-Admins
    - Scope restrictions ("only their own...") produce Allowed (own) and Denied (others)
    - Conflicting rules are tagged Decision='Conflicting' with dual evidence
    """
    rules: List[Dict[str, Any]] = []
    seen_keys: Set[Tuple[str, str, str]] = set()

    all_roles = [r.get("name", "").strip() for r in (ctx.roles or []) if r.get("name")]
    if not all_roles:
        all_roles = ["Guest", "Registered Customer", "Admin", "Support Agent"]

    # 1. From explicit context actions
    for action_item in (ctx.actions or []):
        role = action_item.get("role", "").strip()
        raw_action = action_item.get("action", "").strip()
        req_id = action_item.get("requirement_id")
        if not role or not raw_action:
            continue

        action_name, condition, workflow_state, scope = parse_action_and_condition(raw_action)
        resource = action_name.split()[-1].capitalize() if action_name.split() else "General"

        key = (role.lower(), action_name.lower(), "allowed")
        if key not in seen_keys:
            seen_keys.add(key)
            rules.append({
                "project_id": project_id,
                "role": role,
                "action": action_name,
                "resource": resource,
                "scope": scope,
                "condition": condition,
                "workflow_state": workflow_state,
                "decision": "Allowed",
                "source_quote": raw_action,
                "source_requirement_id": req_id,
                "source_rule_id": None,
                "review_status": "Draft",
                "revision": 1,
                "is_active": True,
                "evidence": {"source": "extracted_actions"}
            })

    # 2. From role permissions list
    for role_item in (ctx.roles or []):
        role = role_item.get("name", "").strip()
        for perm in role_item.get("permissions", []):
            perm_text = perm.strip()
            if not perm_text:
                continue
            action_name, condition, workflow_state, scope = parse_action_and_condition(perm_text)
            resource = action_name.split()[-1].capitalize() if action_name.split() else "General"
            key = (role.lower(), action_name.lower(), "allowed")
            if key not in seen_keys:
                seen_keys.add(key)
                rules.append({
                    "project_id": project_id,
                    "role": role,
                    "action": action_name,
                    "resource": resource,
                    "scope": scope,
                    "condition": condition,
                    "workflow_state": workflow_state,
                    "decision": "Allowed",
                    "source_quote": f"Role '{role}' permission: {perm_text}",
                    "source_requirement_id": None,
                    "source_rule_id": None,
                    "review_status": "Draft",
                    "revision": 1,
                    "is_active": True,
                    "evidence": {"source": "role_permissions"}
                })

    # 3. From Business Rules: Detailed semantic parsing
    for br in (ctx.business_rules or []):
        br_text = br.get("text", "")
        br_id = br.get("id", "BR-xxx")
        source_quote = br.get("source_quote") or br_text
        lower_text = br_text.lower()

        # Check for exclusive pattern: "Only [Role] can/may [action]"
        exclusive_match = re.search(
            r'(?:only|strictly)\s+(?:an?\s+)?([A-Za-z\s]+?)\s+(?:can|is allowed to|may|has the authority to)\s+([^.,;]+)',
            br_text,
            re.IGNORECASE
        )
        if exclusive_match:
            ex_role_raw = exclusive_match.group(1).strip()
            ex_action_raw = exclusive_match.group(2).strip()

            # Match ex_role_raw to known role
            matched_role = next((r for r in all_roles if r.lower() == ex_role_raw.lower()), None)
            if not matched_role:
                # Substring check
                matched_role = next((r for r in all_roles if r.lower() in ex_role_raw.lower()), ex_role_raw.capitalize())

            action_name, condition, workflow_state, scope = parse_action_and_condition(ex_action_raw)
            resource = action_name.split()[-1].capitalize() if action_name.split() else "Workflow"

            # 1. ALLOWED for the exclusive role
            allow_key = (matched_role.lower(), action_name.lower(), "allowed")
            seen_keys.add(allow_key)
            rules.append({
                "project_id": project_id,
                "role": matched_role,
                "action": action_name,
                "resource": resource,
                "scope": scope if scope != "unspecified" else "exclusive",
                "condition": condition,
                "workflow_state": workflow_state,
                "decision": "Allowed",
                "source_quote": source_quote,
                "source_requirement_id": None,
                "source_rule_id": br_id,
                "review_status": "Draft",
                "revision": 1,
                "is_active": True,
                "evidence": {"rule": br_id, "exclusive_grantee": matched_role}
            })

            # 2. DENIED for other roles attempting this action
            for other_role in all_roles:
                if other_role.lower() != matched_role.lower():
                    deny_key = (other_role.lower(), action_name.lower(), "denied")
                    if deny_key not in seen_keys:
                        seen_keys.add(deny_key)
                        rules.append({
                            "project_id": project_id,
                            "role": other_role,
                            "action": action_name,
                            "resource": resource,
                            "scope": "restricted",
                            "condition": f"Exclusive to {matched_role} per {br_id}",
                            "workflow_state": workflow_state,
                            "decision": "Denied",
                            "source_quote": source_quote,
                            "source_requirement_id": None,
                            "source_rule_id": br_id,
                            "review_status": "Draft",
                            "revision": 1,
                            "is_active": True,
                            "evidence": {"rule": br_id, "denial_reason": f"Exclusive permission granted only to {matched_role}"}
                        })
            continue

        # Check for explicit denial: "[Role] cannot / is not allowed to / may not [action]"
        denial_match = re.search(
            r'([A-Za-z\s]+?)\s+(?:cannot|can not|is not allowed to|may not|must not|prohibited from)\s+([^.,;]+)',
            br_text,
            re.IGNORECASE
        )
        if denial_match:
            denied_role_raw = denial_match.group(1).strip()
            denied_action_raw = denial_match.group(2).strip()

            matched_role = next((r for r in all_roles if r.lower() in denied_role_raw.lower()), None)
            if matched_role:
                action_name, condition, workflow_state, scope = parse_action_and_condition(denied_action_raw)
                resource = action_name.split()[-1].capitalize() if action_name.split() else "Workflow"

                deny_key = (matched_role.lower(), action_name.lower(), "denied")
                seen_keys.add(deny_key)
                rules.append({
                    "project_id": project_id,
                    "role": matched_role,
                    "action": action_name,
                    "resource": resource,
                    "scope": scope,
                    "condition": condition or f"Explicit prohibition per {br_id}",
                    "workflow_state": workflow_state,
                    "decision": "Denied",
                    "source_quote": source_quote,
                    "source_requirement_id": None,
                    "source_rule_id": br_id,
                    "review_status": "Draft",
                    "revision": 1,
                    "is_active": True,
                    "evidence": {"rule": br_id, "explicit_denial": True}
                })

        # Check for scope/ownership restrictions: "[Role] can [action] only their own [resource]"
        scope_match = re.search(
            r'([A-Za-z\s]+?)\s+(?:can|may)\s+([a-zA-Z\s]+?)\s+(?:only|strictly)\s+(?:their|his|her)\s+own\s+([a-zA-Z\s]+)',
            br_text,
            re.IGNORECASE
        )
        if scope_match:
            s_role = scope_match.group(1).strip()
            s_act = scope_match.group(2).strip()
            s_res = scope_match.group(3).strip()

            matched_role = next((r for r in all_roles if r.lower() in s_role.lower()), s_role.capitalize())
            # Allowed for own
            rules.append({
                "project_id": project_id,
                "role": matched_role,
                "action": f"{s_act} own {s_res}",
                "resource": s_res.capitalize(),
                "scope": "own records",
                "condition": "Own records only",
                "workflow_state": None,
                "decision": "Allowed",
                "source_quote": source_quote,
                "source_requirement_id": None,
                "source_rule_id": br_id,
                "review_status": "Draft",
                "revision": 1,
                "is_active": True,
                "evidence": {"rule": br_id, "scope": "own records"}
            })
            # Denied for others'
            rules.append({
                "project_id": project_id,
                "role": matched_role,
                "action": f"{s_act} other users' {s_res}",
                "resource": s_res.capitalize(),
                "scope": "other users' records",
                "condition": "Prohibited from accessing non-owned records",
                "workflow_state": None,
                "decision": "Denied",
                "source_quote": source_quote,
                "source_requirement_id": None,
                "source_rule_id": br_id,
                "review_status": "Draft",
                "revision": 1,
                "is_active": True,
                "evidence": {"rule": br_id, "scope_restriction": True}
            })

        # Check for standard grant: "[Role] can/may/is authorized to [action]"
        elif not denial_match and not exclusive_match and not scope_match:
            grant_match = re.search(
                r'([A-Za-z\s]+?)\s+(?:can|may|is authorized to|is allowed to)\s+([^.,;]+)',
                br_text,
                re.IGNORECASE
            )
            if grant_match:
                g_role_raw = grant_match.group(1).strip()
                g_action_raw = grant_match.group(2).strip()
                matched_role = next((r for r in all_roles if r.lower() in g_role_raw.lower() or g_role_raw.lower() in r.lower()), g_role_raw.rstrip('s').capitalize())

                action_name, condition, workflow_state, scope = parse_action_and_condition(g_action_raw)
                resource = action_name.split()[-1].capitalize() if action_name.split() else "General"

                allow_key = (matched_role.lower(), action_name.lower(), "allowed")
                seen_keys.add(allow_key)
                rules.append({
                    "project_id": project_id,
                    "role": matched_role,
                    "action": action_name,
                    "resource": resource,
                    "scope": scope,
                    "condition": condition,
                    "workflow_state": workflow_state,
                    "decision": "Allowed",
                    "source_quote": source_quote,
                    "source_requirement_id": None,
                    "source_rule_id": br_id,
                    "review_status": "Draft",
                    "revision": 1,
                    "is_active": True,
                    "evidence": {"rule": br_id, "grant": True}
                })

    # Conflict detection pass: if the same role has both Allowed and Denied for similar action/resource
    conflict_resolved: List[Dict[str, Any]] = []
    seen_conflict_pairs: Set[Tuple[str, str]] = set()

    for r in rules:
        role_k = r["role"].lower()
        res_k = r["resource"].lower()
        pair_k = (role_k, res_k)

        # Look for opposing rule
        opposing = [
            other for other in rules
            if other["role"].lower() == role_k and other["resource"].lower() == res_k
            and (
                (r["decision"] == "Allowed" and other["decision"] == "Denied") or
                (r["decision"] == "Denied" and other["decision"] == "Allowed")
            )
        ]

        if opposing and not r.get("condition") and not opposing[0].get("condition"):
            # Conflicting statements without resolving condition
            if pair_k not in seen_conflict_pairs:
                seen_conflict_pairs.add(pair_k)
                other_rule = opposing[0]
                conflict_resolved.append({
                    "project_id": project_id,
                    "role": r["role"],
                    "action": r["action"],
                    "resource": r["resource"],
                    "scope": r.get("scope", "unspecified"),
                    "condition": "Conflicting statements in source documentation",
                    "workflow_state": r.get("workflow_state"),
                    "decision": "Conflicting",
                    "source_quote": f"1: {r.get('source_quote')} | 2: {other_rule.get('source_quote')}",
                    "source_requirement_id": r.get("source_requirement_id") or other_rule.get("source_requirement_id"),
                    "source_rule_id": r.get("source_rule_id"),
                    "review_status": "Draft",
                    "revision": 1,
                    "is_active": True,
                    "evidence": {
                        "conflicting": True,
                        "quote_allowed": r.get("source_quote") if r["decision"] == "Allowed" else other_rule.get("source_quote"),
                        "quote_denied": r.get("source_quote") if r["decision"] == "Denied" else other_rule.get("source_quote"),
                    }
                })
        else:
            if pair_k not in seen_conflict_pairs:
                conflict_resolved.append(r)

    return conflict_resolved


def reconcile_permission_rules(
    existing_rules: List[PermissionRule],
    new_extracted_rules: List[Dict[str, Any]],
    project_id: str
) -> List[PermissionRule]:
    """
    Reconciles existing permission rules with newly extracted rules:
    - Retains stable PR-001 IDs
    - Preserves reviewer-confirmed and corrected decisions
    - Marks missing/superseded rules as is_active=False without deleting
    """
    # Key mapping: (role.lower(), action.lower()[:50])
    existing_map: Dict[Tuple[str, str], PermissionRule] = {
        (r.role.lower(), r.action.lower()[:50]): r
        for r in existing_rules
    }

    max_counter = 0
    for r in existing_rules:
        # Extract number if ID matches PR-xxx
        if r.id.startswith("PR-"):
            try:
                num = int(r.id.split("-")[1])
                if num > max_counter:
                    max_counter = num
            except Exception:
                pass

    active_rule_ids: Set[str] = set()
    result: List[PermissionRule] = []

    for new_r in new_extracted_rules:
        key = (new_r["role"].lower(), new_r["action"].lower()[:50])
        existing = existing_map.get(key)

        if existing:
            # If reviewer confirmed or corrected, preserve human decision
            if existing.review_status in ("Confirmed", "Corrected"):
                existing.is_active = True
                active_rule_ids.add(existing.id)
                result.append(existing)
            else:
                # Update draft with latest extraction details while preserving stable ID
                existing.resource = new_r.get("resource") or existing.resource
                existing.scope = new_r.get("scope") or existing.scope
                existing.condition = new_r.get("condition") or existing.condition
                existing.workflow_state = new_r.get("workflow_state") or existing.workflow_state
                existing.decision = new_r.get("decision", "Allowed")
                existing.source_quote = new_r.get("source_quote") or existing.source_quote
                existing.source_requirement_id = new_r.get("source_requirement_id") or existing.source_requirement_id
                existing.source_rule_id = new_r.get("source_rule_id") or existing.source_rule_id
                existing.evidence = new_r.get("evidence") or existing.evidence
                existing.is_active = True
                active_rule_ids.add(existing.id)
                result.append(existing)
        else:
            # New rule: assign next stable ID
            max_counter += 1
            stable_id = f"PR-{max_counter:03d}"
            rule_row = PermissionRule(
                id=stable_id,
                project_id=project_id,
                role=new_r["role"],
                action=new_r["action"],
                resource=new_r.get("resource", "General"),
                scope=new_r.get("scope", "unspecified"),
                condition=new_r.get("condition"),
                workflow_state=new_r.get("workflow_state"),
                decision=new_r.get("decision", "Allowed"),
                source_quote=new_r.get("source_quote", ""),
                source_location=new_r.get("source_location"),
                source_requirement_id=new_r.get("source_requirement_id"),
                source_rule_id=new_r.get("source_rule_id"),
                review_status=new_r.get("review_status", "Draft"),
                reviewer_notes=new_r.get("reviewer_notes"),
                revision=1,
                is_active=True,
                evidence=new_r.get("evidence", {})
            )
            active_rule_ids.add(stable_id)
            result.append(rule_row)

    # Mark remaining unreferenced existing rules as superseded rather than deleting
    for r in existing_rules:
        if r.id not in active_rule_ids:
            r.is_active = False
            r.review_status = "Superseded"
            result.append(r)

    return result


def extract_permission_rules(text: str, project_id: str = "proj-default") -> List[Dict[str, Any]]:
    """
    Convenience wrapper to extract permission rules directly from text.
    Constructs an ExtractedContext from raw business statements and parses them.
    """
    sentences = [s.strip() for s in re.split(r'[\n.]+', text) if s.strip()]
    business_rules = [{"id": f"BR-{i+1:03d}", "text": s, "source_quote": s} for i, s in enumerate(sentences)]

    # Identify potential roles mentioned in the text
    potential_roles = [
        "Admin", "Auditor", "Manager", "Employee", "Supervisor", "Customer",
        "Support Agent", "Guest", "Finance Officer", "CFO"
    ]
    found_roles = []
    for r in potential_roles:
        if re.search(r'\b' + re.escape(r) + r'(?:s|es)?\b', text, re.IGNORECASE):
            found_roles.append({"id": f"ROLE-{len(found_roles)+1}", "name": r, "permissions": []})

    if not found_roles:
        found_roles = [{"id": "ROLE-1", "name": "Admin", "permissions": []}, {"id": "ROLE-2", "name": "User", "permissions": []}]

    ctx = ExtractedContext(roles=found_roles, business_rules=business_rules, actions=[])
    return analyze_permissions_from_context(ctx, project_id, text)

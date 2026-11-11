import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ScannedMessage, Sender
from .utils import utc_now


@dataclass(frozen=True)
class DemoSenderSpec:
    """Declarative specification for a demo sender and its sample messages."""

    slug: str
    email: str
    name: str
    domain: str
    message_count: int
    unread_count: int
    total_size_bytes: int
    has_unsubscribe: bool
    unsubscribe_url: Optional[str]
    unsubscribe_mailto: Optional[str]
    has_one_click: bool
    categories: str
    sample_subject: str
    templates: Tuple[Tuple[str, str], ...]


DEMO_SENDER_SPECS: Tuple[DemoSenderSpec, ...] = (
    DemoSenderSpec(
        slug="uber",
        email="promotions@marketing.uber.com",
        name="Uber Eats Offers",
        domain="marketing.uber.com",
        message_count=234,
        unread_count=210,
        total_size_bytes=42_500_000,
        has_unsubscribe=True,
        unsubscribe_url="https://uber.com/unsubscribe?token=demo123",
        unsubscribe_mailto=None,
        has_one_click=True,
        categories="promotions",
        sample_subject="40% off your next 3 orders this weekend!",
        templates=(
            (
                "40% off your next 3 orders this weekend!",
                "Use promo code WEEKEND40 at checkout on orders over $20 from participating local restaurants.",
            ),
            (
                "Free delivery on late-night favorites tonight",
                "Craving tacos, ramen, or dessert? Enjoy $0 delivery fee until midnight with Uber One perks.",
            ),
            (
                "Your favorite neighborhood spots just added lunch specials",
                "Order fresh bowls, noodles, and coffee combos with 25% off for a limited lunchtime window.",
            ),
            (
                "Save $15 on grocery & convenience essentials",
                "Stock up on snacks, fresh fruit, coffee, and household staples delivered in under 35 minutes.",
            ),
            (
                "Exclusive offer: 2 months of Uber One on us",
                "Unlock $0 delivery fee, up to 10% off eligible rides and orders, and member-only promotions.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="linkedin",
        email="updates@linkedin.com",
        name="LinkedIn Notifications",
        domain="linkedin.com",
        message_count=412,
        unread_count=389,
        total_size_bytes=38_200_000,
        has_unsubscribe=True,
        unsubscribe_url="https://www.linkedin.com/e/v2/unsub",
        unsubscribe_mailto=None,
        has_one_click=True,
        categories="social",
        sample_subject="You appeared in 14 searches this week",
        templates=(
            (
                "You appeared in 14 searches this week",
                "Recruiters and engineering managers from cloud infrastructure and AI teams viewed your profile activity.",
            ),
            (
                "5 new Senior Software Engineer roles match your preferences",
                "Explore newly posted remote and hybrid engineering openings tailored to your saved alerts.",
            ),
            (
                "A connection shared a post on distributed systems architecture",
                "Join the discussion thread covering SQLite concurrency, event queues, and observability patterns.",
            ),
            (
                "People you may know: expand your developer network",
                "Connect with engineers, founders, and alumni from companies in your industry.",
            ),
            (
                "Weekly network highlights and profile analytics digest",
                "Review post impressions, profile viewers, and skill endorsement updates from the past 7 days.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="morningbrew",
        email="news@morningbrew.com",
        name="Morning Brew",
        domain="morningbrew.com",
        message_count=185,
        unread_count=92,
        total_size_bytes=29_400_000,
        has_unsubscribe=True,
        unsubscribe_url="https://link.morningbrew.com/click/unsub",
        unsubscribe_mailto="mailto:unsub@morningbrew.com?subject=Unsubscribe",
        has_one_click=True,
        categories="updates",
        sample_subject="Why tech is doubling down on chips",
        templates=(
            (
                "Why tech is doubling down on chips",
                "Inside the global semiconductor buildout, data center energy demand, and market reactions to earnings.",
            ),
            (
                "Rate outlook, retail spending & cloud margins",
                "Everything you need to know before the opening bell in five minutes or less.",
            ),
            (
                "Startups rethink remote offices and SaaS pricing",
                "Why usage-based billing and leaner distributed teams are reshaping enterprise software budgets.",
            ),
            (
                "Clean energy grids meet surging compute demand",
                "Utility providers and cloud operators sign record long-term grid and battery storage agreements.",
            ),
            (
                "Weekend Brew: The rise of local-first productivity tools",
                "Why privacy-conscious users are returning to fast local apps backed by SQLite.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="amazon",
        email="deals@amazon.com",
        name="Amazon.com Deals",
        domain="amazon.com",
        message_count=520,
        unread_count=510,
        total_size_bytes=98_000_000,
        has_unsubscribe=True,
        unsubscribe_url="https://www.amazon.com/gp/gss/o/demo",
        unsubscribe_mailto=None,
        has_one_click=False,
        categories="promotions",
        sample_subject="Lightning Deals hand-picked for you",
        templates=(
            (
                "Lightning Deals hand-picked for you",
                "Discover limited-time markdowns across NVMe drives, developer desk accessories, and ergonomic stands.",
            ),
            (
                "Your Daily Deals: Up to 45% off Echo, Kindle & Smart Home",
                "Save big on top-rated tech gadgets, USB-C hubs, mechanical keyboards, and Lightning Deals on your wishlist.",
            ),
            (
                "Price drop alert: items in your Saved for Later list",
                "Good news! 3 items you viewed recently dropped by 22%. Compare offers before the promo window closes.",
            ),
            (
                "Weekend Prime Savings: Electronics & Home Office Essentials",
                "Exclusive bundle pricing on noise-canceling headphones, 4K webcams, and standing desk converters.",
            ),
            (
                "Flash coupons on USB-C chargers & travel adapters",
                "Clip instant savings on compact GaN fast chargers, braided cables, and portable power banks.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="tldr",
        email="newsletter@tldr.tech",
        name="TLDR Newsletter",
        domain="tldr.tech",
        message_count=145,
        unread_count=30,
        total_size_bytes=18_300_000,
        has_unsubscribe=True,
        unsubscribe_url="https://tldr.tech/actions/unsubscribe",
        unsubscribe_mailto=None,
        has_one_click=True,
        categories="updates",
        sample_subject="OpenAI releases new models & AI breakthroughs",
        templates=(
            (
                "OpenAI releases new models & AI breakthroughs",
                "Byte-sized summaries of frontier reasoning benchmarks, open-weight tooling, and developer API updates.",
            ),
            (
                "Docker Compose adds faster local watch workflows",
                "Plus: Chromium DevTools Protocol tips, TypeScript strictness checks, and build caching tricks.",
            ),
            (
                "Why SQLite WAL mode powers modern local apps",
                "Deep dive into single-node reliability, zero-latency reads, and simplified local backup strategies.",
            ),
            (
                "GitHub Actions runners & CI caching best practices",
                "Cut CI times in half with dependency caching, matrix pruning, and isolated Python virtualenvs.",
            ),
            (
                "RFC 8058 One-Click Unsubscribe adoption report",
                "How major mailbox providers enforce authenticated bulk sender headers and cleaner inbox standards.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="github",
        email="notifications@github.com",
        name="GitHub",
        domain="github.com",
        message_count=680,
        unread_count=45,
        total_size_bytes=45_000_000,
        has_unsubscribe=True,
        unsubscribe_url="https://github.com/notifications/unsubscribe-auth/demo",
        unsubscribe_mailto=None,
        has_one_click=False,
        categories="updates,forums",
        sample_subject="[Docker/compose] Pull request #1042 merged",
        templates=(
            (
                "[Docker/compose] Pull request #1042 merged",
                "Merged into main with 3 approving reviews. All CI checks passed on Ubuntu and Windows runners.",
            ),
            (
                "[fastapi/fastapi] Release v0.115.0 published",
                "Highlights include AsyncSession lifecycle improvements, OpenAPI refinements, and dependency updates.",
            ),
            (
                "[vite/vite] Issue #18421: Static asset caching headers",
                "@contributor commented: Verified fix in production build pipeline and added regression coverage.",
            ),
            (
                "[security] Dependabot alert resolved in frontend lockfile",
                "Automated PR updated transitive dependencies to patched versions with zero breaking API changes.",
            ),
            (
                "[sqlalchemy/sqlalchemy] Discussion: Async SQLite best practices",
                "Maintainers shared recommended timeout and transaction scoping patterns for concurrent background tasks.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="twitter",
        email="info@twitter.com",
        name="X / Twitter",
        domain="twitter.com",
        message_count=310,
        unread_count=298,
        total_size_bytes=31_000_000,
        has_unsubscribe=True,
        unsubscribe_url="https://twitter.com/i/u?token=demo",
        unsubscribe_mailto=None,
        has_one_click=True,
        categories="social",
        sample_subject="Trending in your area today",
        templates=(
            (
                "Trending in your area today",
                "Catch up on top technology threads, developer discussions, and open-source launches today.",
            ),
            (
                "Highlights from accounts you follow",
                "Threads on clean UI architecture, headless browser automation, and open-source release checklists.",
            ),
            (
                "New replies to a conversation you bookmarked",
                "Three developers shared benchmarks comparing static SPA bundles versus hot-reload dev servers.",
            ),
            (
                "Suggested accounts in Software & Engineering",
                "Follow creators posting systems design walkthroughs, Python tips, and frontend patterns.",
            ),
            (
                "Your weekly engagement & bookmark recap",
                "Revisit popular posts and technical threads saved over the past week.",
            ),
        ),
    ),
    DemoSenderSpec(
        slug="medium",
        email="noreply@medium.com",
        name="Medium Daily Digest",
        domain="medium.com",
        message_count=195,
        unread_count=180,
        total_size_bytes=24_000_000,
        has_unsubscribe=True,
        unsubscribe_url="https://medium.com/me/unsubscribe/demo",
        unsubscribe_mailto=None,
        has_one_click=True,
        categories="updates",
        sample_subject="Top stories in Software Engineering for you",
        templates=(
            (
                "Top stories in Software Engineering for you",
                "Designing Local-First Web Apps with FastAPI, React, and SQLite — plus 6 curated weekend reads.",
            ),
            (
                "5 Lessons From Securing Open-Source OAuth Apps",
                "Keeping client secrets out of git history, path traversal guards, and CSV formula sanitization.",
            ),
            (
                "Understanding RFC 8058 One-Click Email Unsubscribe",
                "A practical guide to List-Unsubscribe-Post headers and automated mailto fallback workflows.",
            ),
            (
                "Building Responsive Dark-Mode Dashboards in Tailwind CSS",
                "Layout patterns for dense analytics tables, floating bulk action bars, and slide-over drawers.",
            ),
            (
                "Testing Async Python APIs With Pytest & HTTPX",
                "Using ASGITransport for fast in-memory endpoint tests without external network dependencies.",
            ),
        ),
    ),
)

DEMO_SPECS_BY_EMAIL: Dict[str, DemoSenderSpec] = {
    spec.email: spec for spec in DEMO_SENDER_SPECS
}


def _category_labels(categories: str) -> List[str]:
    return [f"CATEGORY_{cat.strip().upper()}" for cat in categories.split(",") if cat.strip()]


def _compute_message_sizes(total_size_bytes: int, count: int) -> List[int]:
    """Allocates varied positive byte estimates summing cleanly to total_size_bytes."""
    if count <= 0:
        return []
    if total_size_bytes <= 0:
        return [0] * count

    offsets = (-0.18, -0.07, 0.0, 0.09, 0.16)
    base = max(1, total_size_bytes // count)
    sizes = [max(1, int(base * (1.0 + offsets[i % len(offsets)]))) for i in range(count)]

    diff = total_size_bytes - sum(sizes)
    step_adj, rem = divmod(abs(diff), count)
    sign = 1 if diff >= 0 else -1
    for i in range(count):
        delta = sign * (step_adj + (1 if i < rem else 0))
        sizes[i] = max(1, sizes[i] + delta)

    residual = total_size_bytes - sum(sizes)
    if residual != 0 and sizes[0] + residual >= 1:
        sizes[0] += residual
    return sizes


def build_demo_sender(spec: DemoSenderSpec, now: Optional[datetime] = None) -> Sender:
    """Constructs a Demo Mode Sender ORM record from a spec."""
    ts = now or utc_now()
    return Sender(
        email=spec.email,
        name=spec.name,
        domain=spec.domain,
        message_count=spec.message_count,
        unread_count=spec.unread_count,
        total_size_bytes=spec.total_size_bytes,
        has_unsubscribe=spec.has_unsubscribe,
        unsubscribe_url=spec.unsubscribe_url,
        unsubscribe_mailto=spec.unsubscribe_mailto,
        has_one_click=spec.has_one_click,
        categories=spec.categories,
        sample_subject=spec.sample_subject,
        last_received_at=ts,
    )


def build_demo_messages_for_spec(
    spec: DemoSenderSpec,
    count: Optional[int] = None,
    unread_count: Optional[int] = None,
    total_size_bytes: Optional[int] = None,
    now: Optional[datetime] = None,
) -> List[ScannedMessage]:
    """Builds synthetic ScannedMessage rows aligned with a sender's summary stats."""
    msg_count = spec.message_count if count is None else max(0, count)
    if msg_count == 0:
        return []

    unread_target = spec.unread_count if unread_count is None else max(0, min(unread_count, msg_count))
    total_bytes = spec.total_size_bytes if total_size_bytes is None else max(0, total_size_bytes)

    ts = now or utc_now()
    cat_labels = _category_labels(spec.categories)
    sizes = _compute_message_sizes(total_bytes, msg_count)
    templates = spec.templates

    records: List[ScannedMessage] = []
    for i in range(msg_count):
        subj_base, snippet = templates[i % len(templates)]
        msg_date = ts - timedelta(hours=3 + i * 6)
        subject = subj_base if i < len(templates) else f"{subj_base} ({msg_date.strftime('%b %d')})"

        labels = ["INBOX"]
        if i < unread_target:
            labels.append("UNREAD")
        labels.extend(cat_labels)

        records.append(
            ScannedMessage(
                id=f"demo_{spec.slug}_{i:04d}",
                thread_id=f"demo_thr_{spec.slug}_{i:04d}",
                sender_email=spec.email,
                sender_name=spec.name,
                subject=subject,
                snippet=snippet,
                date=msg_date,
                size_estimate=sizes[i],
                label_ids=json.dumps(labels),
                has_unsubscribe=spec.has_unsubscribe,
                unsubscribe_url=spec.unsubscribe_url,
                unsubscribe_mailto=spec.unsubscribe_mailto,
                has_one_click=spec.has_one_click,
            )
        )
    return records


def is_unhydrated_demo_sender(sender: Optional[Sender]) -> bool:
    """Returns True when sender is an un-hydrated built-in demo sender needing sample messages."""
    if not sender or sender.message_count <= 0:
        return False
    spec = DEMO_SPECS_BY_EMAIL.get(sender.email)
    if not spec:
        return False
    return (
        sender.unsubscribe_url == spec.unsubscribe_url
        and sender.sample_subject == spec.sample_subject
        and sender.message_count == spec.message_count
    )


async def seed_demo_inbox(db: AsyncSession) -> int:
    """Seeds demo senders and backfills missing individual demo messages idempotently."""
    now = utc_now()
    demo_emails = [spec.email for spec in DEMO_SENDER_SPECS]

    sender_res = await db.execute(select(Sender).where(Sender.email.in_(demo_emails)))
    existing_senders = {s.email: s for s in sender_res.scalars().all()}

    msg_count_res = await db.execute(
        select(ScannedMessage.sender_email, func.count(ScannedMessage.id))
        .where(ScannedMessage.sender_email.in_(demo_emails))
        .group_by(ScannedMessage.sender_email)
    )
    existing_msg_counts = {email: cnt for email, cnt in msg_count_res.all()}

    new_records: List[object] = []
    for spec in DEMO_SENDER_SPECS:
        existing = existing_senders.get(spec.email)
        msg_cnt = existing_msg_counts.get(spec.email, 0)

        if not existing:
            new_records.append(build_demo_sender(spec, now=now))
            if msg_cnt == 0:
                new_records.extend(build_demo_messages_for_spec(spec, now=now))
        elif existing.message_count > 0 and msg_cnt == 0:
            # Upgrade path for databases seeded prior to individual demo message population.
            new_records.extend(
                build_demo_messages_for_spec(
                    spec,
                    count=existing.message_count,
                    unread_count=existing.unread_count,
                    total_size_bytes=existing.total_size_bytes,
                    now=now,
                )
            )

    if new_records:
        db.add_all(new_records)
        await db.commit()

    return len(DEMO_SENDER_SPECS)

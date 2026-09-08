"""A small, strict RFC 5545 reader and writer.

Hand-written rather than a dependency. The subset a channel calendar uses is
tiny — VEVENT, DTSTART, DTEND, UID, SUMMARY — and the general-purpose libraries
bring timezone databases and recurrence engines for none of it.

The parts that are easy to get wrong, and are therefore done properly here:

* **Line folding.** RFC 5545 wraps long lines and continues them with a leading
  space. Parsing without unfolding first silently truncates URLs and summaries.
* **DTEND is exclusive** for ``VALUE=DATE`` events, which is exactly how
  ``Booking.check_out`` already behaves. The two models line up with no
  off-by-one, and a same-day turnover stays legal on both sides.
* **Text escaping.** Commas, semicolons and newlines are backslash-escaped in
  iCal values, and a name with a comma in it round-trips wrongly without it.
* **Folding by octets, not characters.** The 75-unit limit is bytes, and
  splitting a multi-byte character across a fold produces a corrupt feed. Thai
  condo names make this reachable rather than theoretical.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

#: RFC 5545's content line limit, in octets, including the leading space that
#: continuation lines carry.
_LINE_OCTETS = 75

PRODID = "-//LocalShouts//Stays//EN"


class ICalError(ValueError):
    """The payload was not a calendar we can read."""


@dataclass(frozen=True, slots=True)
class VEvent:
    uid: str
    start: date
    #: Exclusive.
    end: date
    summary: str | None = None
    description: str | None = None


# --------------------------------------------------------------------------
# reading
# --------------------------------------------------------------------------


def _unfold(raw: str) -> list[str]:
    """Undo RFC 5545 line folding, tolerating CRLF, CR or LF."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for line in text.split("\n"):
        if line[:1] in (" ", "\t") and lines:
            # A continuation: the single leading whitespace is the fold marker
            # and is not part of the value.
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def _split_line(line: str) -> tuple[str, dict[str, str], str]:
    """``NAME;PARAM=value:content`` into its three parts.

    The colon scan skips quoted parameter values, because a parameter may
    legitimately contain one (``ALTREP="http://..."``) and splitting on the
    first colon regardless would cut the line in the wrong place.
    """
    in_quotes = False
    split_at = -1
    for index, char in enumerate(line):
        if char == '"':
            in_quotes = not in_quotes
        elif char == ":" and not in_quotes:
            split_at = index
            break
    if split_at < 0:
        return "", {}, ""

    head, value = line[:split_at], line[split_at + 1 :]
    segments = head.split(";")
    params: dict[str, str] = {}
    for segment in segments[1:]:
        if "=" in segment:
            key, raw_value = segment.split("=", 1)
            params[key.strip().upper()] = raw_value.strip().strip('"')
    return segments[0].strip().upper(), params, value


def _parse_date(value: str) -> date:
    """``20260915`` or ``20260915T140000Z`` to a date.

    Times are truncated rather than converted. A channel calendar is day
    granular; keeping a time would invent precision the source does not have,
    and converting between zones would move a booking across midnight.
    """
    text = value.strip()
    if "T" in text:
        text = text.split("T", 1)[0]
    if len(text) != 8 or not text.isdigit():
        raise ICalError(f"Not a calendar date: {value!r}")
    return date(int(text[:4]), int(text[4:6]), int(text[6:8]))


def _unescape(value: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(value):
        char = value[index]
        if char == "\\" and index + 1 < len(value):
            nxt = value[index + 1]
            out.append({"n": "\n", "N": "\n"}.get(nxt, nxt))
            index += 2
            continue
        out.append(char)
        index += 1
    return "".join(out)


def parse_events(raw: str) -> list[VEvent]:
    """Every VEVENT in a calendar, in file order.

    Raises :class:`ICalError` when the payload is not a calendar at all — which
    is how a stale or wrong URL is told apart from a genuinely empty one. An
    individual VEVENT missing a UID or DTSTART is skipped rather than fatal: one
    malformed entry should not cost the other forty.
    """
    if "BEGIN:VCALENDAR" not in raw.upper():
        raise ICalError("Response is not an iCalendar document.")

    events: list[VEvent] = []
    current: dict[str, object] | None = None

    for line in _unfold(raw):
        name, params, value = _split_line(line)
        if not name:
            continue

        if name == "BEGIN" and value.strip().upper() == "VEVENT":
            current = {}
            continue
        if current is None:
            continue
        if name == "END" and value.strip().upper() == "VEVENT":
            event = _build_event(current)
            if event is not None:
                events.append(event)
            current = None
            continue

        if name == "UID":
            current["uid"] = _unescape(value).strip()
        elif name == "DTSTART":
            current["start"] = _safe_date(value)
        elif name == "DTEND":
            current["end"] = _safe_date(value)
        elif name == "SUMMARY":
            current["summary"] = _unescape(value).strip()
        elif name == "DESCRIPTION":
            current["description"] = _unescape(value).strip()
        elif name == "DURATION":
            current["duration_days"] = _duration_days(value)
        _ = params

    return events


def _safe_date(value: str) -> date | None:
    try:
        return _parse_date(value)
    except ICalError:
        return None


def _duration_days(value: str) -> int | None:
    """Only ``P<n>D`` and ``P<n>W``, the two forms a day-granular feed uses."""
    text = value.strip().upper()
    if not text.startswith("P") or len(text) < 3:
        return None
    body, unit = text[1:-1], text[-1]
    if not body.isdigit():
        return None
    if unit == "D":
        return int(body)
    if unit == "W":
        return int(body) * 7
    return None


def _build_event(fields: dict[str, object]) -> VEvent | None:
    uid = fields.get("uid")
    start = fields.get("start")
    if not isinstance(uid, str) or not uid or not isinstance(start, date):
        return None

    end = fields.get("end")
    if not isinstance(end, date):
        days = fields.get("duration_days")
        span = days if isinstance(days, int) and days > 0 else 1
        # RFC 5545: a DATE event with neither DTEND nor DURATION lasts one day.
        end = date.fromordinal(start.toordinal() + span)
    if end <= start:
        # A zero or negative span would claim no nights, and downstream every
        # consumer assumes at least one.
        end = date.fromordinal(start.toordinal() + 1)

    summary = fields.get("summary")
    description = fields.get("description")
    return VEvent(
        uid=uid,
        start=start,
        end=end,
        summary=summary if isinstance(summary, str) and summary else None,
        description=description if isinstance(description, str) and description else None,
    )


# --------------------------------------------------------------------------
# writing
# --------------------------------------------------------------------------


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Wrap to 75 octets, never splitting a multi-byte character."""
    data = line.encode("utf-8")
    if len(data) <= _LINE_OCTETS:
        return line

    chunks: list[str] = []
    start = 0
    # The first line gets the full budget; continuations spend one octet on
    # the leading space that marks them as continuations.
    budget = _LINE_OCTETS
    while start < len(data):
        end = min(start + budget, len(data))
        # Walk back off a UTF-8 continuation byte so a character is never cut.
        while end > start + 1 and end < len(data) and (data[end] & 0xC0) == 0x80:
            end -= 1
        chunks.append(data[start:end].decode("utf-8"))
        start = end
        budget = _LINE_OCTETS - 1
    return "\r\n ".join(chunks)


def _stamp(moment: datetime) -> str:
    return moment.strftime("%Y%m%dT%H%M%SZ")


def build_calendar(
    events: list[VEvent],
    *,
    name: str,
    now: datetime | None = None,
) -> str:
    """Serialise events into a publishable calendar.

    CRLF throughout: RFC 5545 requires it, and at least one major consumer
    rejects a bare-LF calendar outright.
    """
    moment = now or datetime.now(UTC).replace(tzinfo=None)
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(name)}",
    ]
    for event in events:
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{_escape(event.uid)}",
                f"DTSTAMP:{_stamp(moment)}",
                f"DTSTART;VALUE=DATE:{event.start:%Y%m%d}",
                f"DTEND;VALUE=DATE:{event.end:%Y%m%d}",
                f"SUMMARY:{_escape(event.summary or 'Not available')}",
                "TRANSP:OPAQUE",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"

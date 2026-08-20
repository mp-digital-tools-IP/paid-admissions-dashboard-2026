#!/usr/bin/env python3
"""Local entry point for building dashboard aggregates without personal data.

The input export is read only on this computer. Personal fields are used in
memory only for unique-person counting and contract deduplication; the written
JSON contains aggregate metrics and non-personal academic dimensions only.
"""

from update_dashboard import main


if __name__ == "__main__":
    raise SystemExit(main())

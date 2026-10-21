"""One tiny Anthropic call to prove ANTHROPIC_API_KEY and ANTHROPIC_MODEL work."""

import os
import sys

import anthropic

DEFAULT_MODEL = "claude-sonnet-5-5"


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set", file=sys.stderr)
        return 1
    model = os.environ.get("ANTHROPIC_MODEL") or DEFAULT_MODEL
    client = anthropic.Anthropic(timeout=30)
    message = client.messages.create(
        model=model,
        max_tokens=16,
        messages=[{"role": "user", "content": "Reply with exactly: ok"}],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    print(f"model={message.model} reply={text.strip()!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

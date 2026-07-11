# PrivyQ v2 — Python examples

Runnable demonstrations of the v2 verbs. Start a local core first:

```bash
cd core-go && make build && KEY_STORAGE=memory ./privyqd   # :50051
pip install -e sdk-python
python examples/python/01_pdp_check.py
python examples/python/02_seal_and_compliance.py
```

- **01_pdp_check.py** — `check()` as a Policy-Decision point: a banking approval-limit
  policy with break-glass, replacing an `if`-ladder with one policy + one call.
- **02_seal_and_compliance.py** — `protect`/`check`/`access`, `seal()`/`verify()`, and a
  PDF evidence export for compliance.

(JavaScript/TypeScript equivalents live in `examples/js/`.)

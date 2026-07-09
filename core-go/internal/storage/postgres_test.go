package storage

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/core"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// Requires a reachable Postgres via PRIVYQ_TEST_DB. Skips otherwise so the unit
// suite stays hermetic (ARCH §23.2 integration tests use a real DB).
func testDSN(t *testing.T) string {
	dsn := os.Getenv("PRIVYQ_TEST_DB")
	if dsn == "" {
		t.Skip("set PRIVYQ_TEST_DB to run Postgres-backed tests")
	}
	return dsn
}

func TestPostgresPersistenceSurvivesRestart(t *testing.T) {
	dsn := testDSN(t)
	ctx := context.Background()

	// First "process": protect + access, producing keys and an evidence chain.
	pg1, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	svc1 := core.New(keymanager.New(pg1.Keys()), pg1.Evidence(), "test")
	policy := types.Policy{Combination: "all", Conditions: []types.Condition{
		{Type: "role", Operator: "equals", Values: []string{"doctor"}},
	}}
	env, _, err := svc1.Protect([]byte("persisted record"), policy, "", "", "patient_p1", types.Identity{UserID: "dr", Role: "doctor"})
	if err != nil {
		t.Fatal(err)
	}
	raw := mustJSON(t, env)
	if _, _, err := svc1.Access(raw, types.Identity{Role: "doctor"}, types.Context{}); err != nil {
		t.Fatal(err)
	}
	countBefore, _ := pg1.Evidence().Count()
	pg1.Close()

	// Second "process": reopen the DB and confirm the chain survived and verifies.
	pg2, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pg2.Close()
	svc2 := core.New(keymanager.New(pg2.Keys()), pg2.Evidence(), "test")
	entries, total, chainOK, err := svc2.EvidenceLog(audit.Filter{}, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if int64(total) < countBefore || !chainOK {
		t.Fatalf("chain did not survive restart: total=%d before=%d ok=%v", total, countBefore, chainOK)
	}
	if len(entries) == 0 {
		t.Fatal("no entries after restart")
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

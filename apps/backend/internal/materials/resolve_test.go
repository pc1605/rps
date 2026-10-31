package materials

import "testing"

func TestResolveQty(t *testing.T) {
	const sheet, velcro, thread = 1, 2, 3
	w54, w60, w72 := 54, 60, 72
	ip := func(v int) *int { return &v }

	lines := RecipeLines{
		{TypeID: sheet, VariantID: nil, Qty: 1600},  // any width 1.6
		{TypeID: sheet, VariantID: &w54, Qty: 1790}, // 54″ 1.79
		{TypeID: sheet, VariantID: &w72, Qty: 1410}, // 72″ 1.41
		{TypeID: velcro, VariantID: nil, Qty: 300},
		{TypeID: thread, VariantID: &w60, Qty: 50}, // variant-only line, no "any"
	}
	overrides := Overrides{
		{TypeID: sheet, VariantID: &w60, Qty: 2900}, // car: 2.9 on 60″
		{TypeID: velcro, VariantID: nil, Qty: 0},    // car doesn't use velcro
	}

	tests := []struct {
		name    string
		lines   RecipeLines
		ovr     Overrides
		typeID  int
		variant *int
		want    *int64
		source  string
	}{
		{"car override for this variant wins", lines, overrides, sheet, ip(60), i64(2900), SourceCarVariant},
		{"recipe variant when car has no override for it", lines, overrides, sheet, ip(54), i64(1790), SourceRecipeVariant},
		{"recipe any when no line for this variant", lines, overrides, sheet, ip(66), i64(1600), SourceRecipeAny},
		{"recipe any when lot has no variant", lines, overrides, sheet, nil, i64(1600), SourceRecipeAny},
		{"car any override 0 = not consumed", lines, overrides, velcro, nil, i64(0), SourceCarAny},
		{"car any override beats recipe variant", lines,
			Overrides{{TypeID: sheet, Qty: 2000}}, sheet, ip(54), i64(2000), SourceCarAny},
		{"car variant beats car any", lines,
			Overrides{{TypeID: sheet, Qty: 2000}, {TypeID: sheet, VariantID: ip(54), Qty: 2100}}, sheet, ip(54), i64(2100), SourceCarVariant},
		{"car variant override 0 beats recipe", lines,
			Overrides{{TypeID: sheet, VariantID: ip(72), Qty: 0}}, sheet, ip(72), i64(0), SourceCarVariant},
		{"variant-only line matches its variant", lines, nil, thread, ip(60), i64(50), SourceRecipeVariant},
		{"variant-only line does not match another variant", lines, nil, thread, ip(54), nil, SourceNone},
		{"variant-only line does not match no-variant lot", lines, nil, thread, nil, nil, SourceNone},
		{"type with no line and no override", lines, overrides, 99, nil, nil, SourceNone},
		{"no recipe at all", nil, nil, sheet, ip(60), nil, SourceNone},
		{"override for another type ignored", nil, Overrides{{TypeID: velcro, Qty: 0}}, sheet, nil, nil, SourceNone},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, src := resolveQty(tt.lines, tt.ovr, tt.typeID, tt.variant)
			if src != tt.source {
				t.Errorf("source = %q, want %q", src, tt.source)
			}
			switch {
			case tt.want == nil && got != nil:
				t.Errorf("qty = %v, want nil", *got)
			case tt.want != nil && got == nil:
				t.Errorf("qty = nil, want %d", *tt.want)
			case tt.want != nil && int64(*got) != *tt.want:
				t.Errorf("qty = %d, want %d", int64(*got), *tt.want)
			}
		})
	}
}

func TestMilliString(t *testing.T) {
	for in, want := range map[Milli]string{0: "0", 3000: "3", 12500: "12.5", 1790: "1.79", 50: "0.05", -11000: "-11", -1: "-0.001"} {
		if got := in.String(); got != want {
			t.Errorf("Milli(%d).String() = %q, want %q", int64(in), got, want)
		}
	}
}

func i64(v int64) *int64 { return &v }

package batch

import (
	"fmt"
	"strings"
)

// Milli is a material quantity in thousandths of its unit (numeric(12,3) exactly).
// Quantities never pass through float64: SQL reads `(qty * 1000)::bigint` and
// writes `$n::bigint::numeric / 1000`.
type Milli int64

// String renders 12.500 → "12.5", 3.000 → "3", -0.050 → "-0.05".
func (m Milli) String() string {
	sign := ""
	v := int64(m)
	if v < 0 {
		sign, v = "-", -v
	}
	s := fmt.Sprintf("%d.%03d", v/1000, v%1000)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	return sign + s
}

// Plan sources, most specific first (materials.md "Quantity resolution").
const (
	SourceCarVariant    = "car_variant"
	SourceCarAny        = "car_any"
	SourceRecipeVariant = "recipe_variant"
	SourceRecipeAny     = "recipe_any"
	SourceNone          = "none"
)

// QtyLine is one recipe line or car override: quantity per mat for a material
// type, optionally only for one variant (VariantID nil = any variant).
type QtyLine struct {
	TypeID    int
	VariantID *int
	Qty       Milli
}

// RecipeLines are the lines of the car's recipe (product line × consumption group).
type RecipeLines []QtyLine

// Overrides are the car's per-type exceptions; Qty 0 = "this car doesn't use it".
type Overrides []QtyLine

func find(lines []QtyLine, typeID int, variantID *int) (Milli, bool) {
	for _, l := range lines {
		if l.TypeID != typeID {
			continue
		}
		if (variantID == nil && l.VariantID == nil) ||
			(variantID != nil && l.VariantID != nil && *l.VariantID == *variantID) {
			return l.Qty, true
		}
	}
	return 0, false
}

// resolveQty returns the quantity per mat of a material type for the variant
// actually used (variantID nil = lot has no variant / none drawn), and which rule
// produced it: car_variant > car_any > recipe_variant > recipe_any > none.
// A zero override returns qty 0 (type not consumed). Source none returns nil.
func resolveQty(lines RecipeLines, overrides Overrides, typeID int, variantID *int) (*Milli, string) {
	try := func(set []QtyLine, v *int, source string) (*Milli, string, bool) {
		if q, ok := find(set, typeID, v); ok {
			return &q, source, true
		}
		return nil, "", false
	}
	if variantID != nil {
		if q, s, ok := try(overrides, variantID, SourceCarVariant); ok {
			return q, s
		}
	}
	if q, s, ok := try(overrides, nil, SourceCarAny); ok {
		return q, s
	}
	if variantID != nil {
		if q, s, ok := try(lines, variantID, SourceRecipeVariant); ok {
			return q, s
		}
	}
	if q, s, ok := try(lines, nil, SourceRecipeAny); ok {
		return q, s
	}
	return nil, SourceNone
}

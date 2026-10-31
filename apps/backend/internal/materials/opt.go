package materials

import "encoding/json"

// Opt distinguishes "absent" (Set=false) from "null" (Set=true, Value=nil) in PATCH bodies.
type Opt[T any] struct {
	Set   bool
	Value *T
}

// UnmarshalJSON is only called when the key is present.
func (o *Opt[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Value = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

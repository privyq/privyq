package policies

// Sandboxed boolean-expression engine for a policy's `custom_logic` (v2 blueprint
// §6.3, closing v1 gap B7 where "custom" silently behaved like "all").
//
// It is deliberately tiny and total: the ONLY things it can do are look up
// attributes and combine comparisons with and/or/not. There is no function call,
// no assignment, no field/host access — so it cannot execute arbitrary code.
//
// Grammar (precedence low→high):
//
//	or   := and ( "or"  and )*
//	and  := not ( "and" not )*
//	not  := "not" not | primary
//	primary := "(" or ")" | comparison
//	comparison := operand ( ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) operand )?
//	operand := NUMBER | STRING | BOOL | IDENT
//
// A bare operand in boolean position is truthy when it is true / 1 / yes / a
// non-zero number. Identifiers resolve from the attribute map (missing => "").

import (
	"fmt"
	"strconv"
	"strings"
)

// evalCustomLogic evaluates expr against vars and returns the boolean result.
// A parse or evaluation error is returned so the caller can fail closed.
func evalCustomLogic(expr string, vars map[string]string) (bool, error) {
	toks, err := lexExpr(expr)
	if err != nil {
		return false, err
	}
	p := &exprParser{toks: toks, vars: vars}
	res, err := p.parseOr()
	if err != nil {
		return false, err
	}
	if p.pos != len(p.toks) {
		return false, fmt.Errorf("unexpected token %q", p.toks[p.pos].text)
	}
	return res, nil
}

type tokKind int

const (
	tIdent tokKind = iota
	tNumber
	tString
	tBool
	tOp
	tAnd
	tOr
	tNot
	tLParen
	tRParen
)

type token struct {
	kind tokKind
	text string
}

func lexExpr(s string) ([]token, error) {
	var toks []token
	i, n := 0, len(s)
	for i < n {
		c := s[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		case c == '(':
			toks = append(toks, token{tLParen, "("})
			i++
		case c == ')':
			toks = append(toks, token{tRParen, ")"})
			i++
		case c == '"' || c == '\'':
			quote := c
			j := i + 1
			for j < n && s[j] != quote {
				j++
			}
			if j >= n {
				return nil, fmt.Errorf("unterminated string literal")
			}
			toks = append(toks, token{tString, s[i+1 : j]})
			i = j + 1
		case c == '=' || c == '!' || c == '<' || c == '>':
			if i+1 < n && s[i+1] == '=' {
				toks = append(toks, token{tOp, s[i : i+2]})
				i += 2
			} else if c == '<' || c == '>' {
				toks = append(toks, token{tOp, string(c)})
				i++
			} else {
				return nil, fmt.Errorf("invalid operator near %q", s[i:])
			}
		case isNumStart(c):
			j := i
			for j < n && (isDigit(s[j]) || s[j] == '.') {
				j++
			}
			toks = append(toks, token{tNumber, s[i:j]})
			i = j
		case isIdentStart(c):
			j := i
			for j < n && isIdentPart(s[j]) {
				j++
			}
			word := s[i:j]
			switch strings.ToLower(word) {
			case "and":
				toks = append(toks, token{tAnd, word})
			case "or":
				toks = append(toks, token{tOr, word})
			case "not":
				toks = append(toks, token{tNot, word})
			case "true", "false":
				toks = append(toks, token{tBool, strings.ToLower(word)})
			default:
				toks = append(toks, token{tIdent, word})
			}
			i = j
		default:
			return nil, fmt.Errorf("unexpected character %q", string(c))
		}
	}
	return toks, nil
}

func isDigit(c byte) bool      { return c >= '0' && c <= '9' }
func isNumStart(c byte) bool   { return isDigit(c) }
func isIdentStart(c byte) bool { return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') }
func isIdentPart(c byte) bool  { return isIdentStart(c) || isDigit(c) || c == '.' || c == '-' }

type exprParser struct {
	toks []token
	pos  int
	vars map[string]string
}

func (p *exprParser) peek() (token, bool) {
	if p.pos < len(p.toks) {
		return p.toks[p.pos], true
	}
	return token{}, false
}

func (p *exprParser) parseOr() (bool, error) {
	left, err := p.parseAnd()
	if err != nil {
		return false, err
	}
	for {
		t, ok := p.peek()
		if !ok || t.kind != tOr {
			return left, nil
		}
		p.pos++
		right, err := p.parseAnd()
		if err != nil {
			return false, err
		}
		left = left || right
	}
}

func (p *exprParser) parseAnd() (bool, error) {
	left, err := p.parseNot()
	if err != nil {
		return false, err
	}
	for {
		t, ok := p.peek()
		if !ok || t.kind != tAnd {
			return left, nil
		}
		p.pos++
		right, err := p.parseNot()
		if err != nil {
			return false, err
		}
		left = left && right
	}
}

func (p *exprParser) parseNot() (bool, error) {
	if t, ok := p.peek(); ok && t.kind == tNot {
		p.pos++
		v, err := p.parseNot()
		if err != nil {
			return false, err
		}
		return !v, nil
	}
	return p.parsePrimary()
}

func (p *exprParser) parsePrimary() (bool, error) {
	t, ok := p.peek()
	if !ok {
		return false, fmt.Errorf("unexpected end of expression")
	}
	if t.kind == tLParen {
		p.pos++
		v, err := p.parseOr()
		if err != nil {
			return false, err
		}
		nt, ok := p.peek()
		if !ok || nt.kind != tRParen {
			return false, fmt.Errorf("missing closing parenthesis")
		}
		p.pos++
		return v, nil
	}
	// comparison or bare operand
	left, err := p.parseOperand()
	if err != nil {
		return false, err
	}
	if t, ok := p.peek(); ok && t.kind == tOp {
		p.pos++
		right, err := p.parseOperand()
		if err != nil {
			return false, err
		}
		return compareValues(t.text, left, right)
	}
	return truthy(left), nil
}

type valueKind int

const (
	vStr valueKind = iota
	vNum
	vBool
)

type value struct {
	kind valueKind
	str  string
	num  float64
	b    bool
}

func (p *exprParser) parseOperand() (value, error) {
	t, ok := p.peek()
	if !ok {
		return value{}, fmt.Errorf("expected a value")
	}
	p.pos++
	switch t.kind {
	case tNumber:
		f, err := strconv.ParseFloat(t.text, 64)
		if err != nil {
			return value{}, fmt.Errorf("bad number %q", t.text)
		}
		return value{kind: vNum, num: f}, nil
	case tString:
		return value{kind: vStr, str: t.text}, nil
	case tBool:
		return value{kind: vBool, b: t.text == "true"}, nil
	case tIdent:
		return value{kind: vStr, str: p.vars[t.text]}, nil
	default:
		return value{}, fmt.Errorf("unexpected token %q", t.text)
	}
}

func (v value) asNumber() (float64, bool) {
	switch v.kind {
	case vNum:
		return v.num, true
	case vStr:
		f, err := strconv.ParseFloat(strings.TrimSpace(v.str), 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func (v value) asString() string {
	switch v.kind {
	case vNum:
		return strconv.FormatFloat(v.num, 'f', -1, 64)
	case vBool:
		if v.b {
			return "true"
		}
		return "false"
	default:
		return v.str
	}
}

func truthy(v value) bool {
	switch v.kind {
	case vBool:
		return v.b
	case vNum:
		return v.num != 0
	default:
		s := strings.ToLower(strings.TrimSpace(v.str))
		return s == "true" || s == "1" || s == "yes"
	}
}

func compareValues(op string, l, r value) (bool, error) {
	switch op {
	case "==", "!=":
		var eq bool
		lf, ok1 := l.asNumber()
		rf, ok2 := r.asNumber()
		if ok1 && ok2 {
			eq = lf == rf
		} else {
			eq = l.asString() == r.asString()
		}
		if op == "!=" {
			return !eq, nil
		}
		return eq, nil
	case "<", "<=", ">", ">=":
		lf, ok1 := l.asNumber()
		rf, ok2 := r.asNumber()
		if !ok1 || !ok2 {
			return false, fmt.Errorf("operator %q needs numeric operands", op)
		}
		switch op {
		case "<":
			return lf < rf, nil
		case "<=":
			return lf <= rf, nil
		case ">":
			return lf > rf, nil
		default:
			return lf >= rf, nil
		}
	default:
		return false, fmt.Errorf("unknown operator %q", op)
	}
}

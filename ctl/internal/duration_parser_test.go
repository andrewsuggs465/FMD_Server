package internal

import (
	"testing"
)

func TestDay(t *testing.T) {
	actual, _ := ParseDurationShortHand("1d")
	expected := SECS_PER_DAY

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestDays(t *testing.T) {
	actual, _ := ParseDurationShortHand("10d")
	expected := SECS_PER_DAY * 10

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestWeeks(t *testing.T) {
	actual, _ := ParseDurationShortHand("2w")
	expected := SECS_PER_DAY * 14

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestMonth(t *testing.T) {
	actual, _ := ParseDurationShortHand("1m")
	expected := SECS_PER_DAY * 31

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestMonths(t *testing.T) {
	actual, _ := ParseDurationShortHand("3m")
	expected := SECS_PER_DAY * 31 * 3

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestEmpty(t *testing.T) {
	actual, _ := ParseDurationShortHand("")
	expected := 0

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestInvalidInt(t *testing.T) {
	actual, actualErr := ParseDurationShortHand("4.2d")
	expected := -1

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}

	if actualErr != ErrInvalidInt {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestUnknownUnit(t *testing.T) {
	actual, actualErr := ParseDurationShortHand("10z")
	expected := -1

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}

	if actualErr != ErrUnknownUnit {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

func TestNoUnit(t *testing.T) {
	actual, actualErr := ParseDurationShortHand("10")
	expected := -1

	if actual != expected {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}

	if actualErr != ErrUnknownUnit {
		t.Errorf(`actual=%d != expected=%d`, actual, expected)
	}
}

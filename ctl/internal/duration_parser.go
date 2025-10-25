package internal

import (
	"errors"
	"strconv"
	// "github.com/rs/zerolog/log"
)

const SECS_PER_DAY = 60 * 60 * 24

var ErrInvalidInt = errors.New("failed to parse string to int")
var ErrUnknownUnit = errors.New("unknown unit")

// Parses a duration shorthand to a duration in Unix milliseconds.
//
// Supported shorthands are:
//
// - 'd' (days)
// - 'w' (weeks)
// - 'm' (months)
func ParseDurationShortHand(in string) (int, error) {
	if len(in) == 0 {
		return 0, nil
	}

	number := in[:len(in)-1]
	unit := in[len(in)-1:]

	numberInt, err := strconv.Atoi(number)
	if err != nil {
		// log.Fatal().Err(err).Str("number", number).Msg("failed to parse string to int")
		return -1, ErrInvalidInt
	}

	// We intentionally don't support hours, because admins should not need to look at user data in hourly granularity.
	switch unit {
	case "d":
		return numberInt * SECS_PER_DAY, nil
	case "w":
		return numberInt * SECS_PER_DAY * 7, nil
	case "m":
		// 31 is good enough. Better an overapproximation than an under-approximation.
		return numberInt * SECS_PER_DAY * 31, nil
	}

	// log.Fatal().Str("unit", unit).Msg("unknown unit")
	return -1, ErrUnknownUnit
}

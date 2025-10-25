package main

import (
	conf "fmd-server/config"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// Global options
var (
	config viper.Viper = conf.InitConfig()

	configPath string
	dbDir      string // used indirectly via config.BindPFlag
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "fmd-server-ctl",
	Short: "Admin CLI for FMD Server",
	// Run: func(cmd *cobra.Command, args []string) {},
}

func init() {
	// No default values as those are handled by the config
	rootCmd.Flags().StringVarP(&configPath, "config", "c", "", "Path to the config file")

	rootCmd.Flags().StringVarP(&dbDir, "db-dir", "d", "", "Path to the database directory")
	config.BindPFlag(conf.CONF_DATABASE_DIR, rootCmd.Flags().Lookup("db-dir"))
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func setupLogging() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
}

func main() {
	execute()
}

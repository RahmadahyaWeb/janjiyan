<?php

namespace App\Support;

class CsvHelper
{
    /**
     * Prefix spreadsheet formula triggers to mitigate CSV formula injection.
     */
    public static function sanitizeCell(mixed $value): string
    {
        $string = (string) ($value ?? '');

        if ($string !== '' && preg_match('/^(?:[\t\r\n ]*[=+\-@]|[\t\r])/', $string) === 1) {
            return "'".$string;
        }

        return $string;
    }

    /**
     * Sanitize every cell in a CSV row before passing it to fputcsv.
     *
     * @param  array<int, mixed>  $row
     * @return array<int, string>
     */
    public static function sanitizeRow(array $row): array
    {
        return array_map(static fn (mixed $cell): string => self::sanitizeCell($cell), $row);
    }
}

# Long Document Batch Translation Test

## Overview

This page is used to observe the behavior of batch translation.

It should trigger multi-paragraph translations, rather than a single-block call.

## Background

The documentation team wants to reduce duplicate translations and reuse already confirmed terminology.

If an article is long, the system should process it in batches while still preserving article-level writeback.

## Terminology

The Wiki is used to consolidate rules.

Spaces are used to organize content.

Tenants are used to isolate data.

## Links

For more information, see [Configuration Guide](./format-heavy.md).

## Commands

Run `docplaybook translate . --force` to force re-translation.

## Conclusion

The focus of this page is not the content itself, but to reliably generate multiple translatable blocks.

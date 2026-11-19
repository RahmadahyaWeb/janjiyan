@extends('errors.layout')

@section('code', '404')
@section('title', 'Halaman tidak ditemukan')
@section('message', 'Tautan yang Anda buka tidak tersedia atau portal booking bisnis tersebut sedang tidak aktif. Periksa kembali alamat URL Anda.')
@section('actions')
    <a href="/" class="btn btn-primary">Kembali ke Beranda</a>
@endsection

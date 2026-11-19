@extends('errors.layout')

@section('code', '500')
@section('title', 'Terjadi gangguan pada server')
@section('message', 'Permintaan Anda belum dapat diproses saat ini. Tunggu beberapa saat lalu muat ulang halaman.')
@section('actions')
    <button type="button" onclick="window.location.reload()" class="btn btn-primary">Coba Muat Ulang</button>
    <a href="/" class="btn btn-outline">Kembali ke Beranda</a>
@endsection
